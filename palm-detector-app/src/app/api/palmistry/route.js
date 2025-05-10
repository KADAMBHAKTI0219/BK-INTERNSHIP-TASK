import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const validateImage = (file) => {
  if (!file) return false;
  if (file.size === 0) return false;
  if (!file.type.startsWith('image/')) return false;
  return true;
};

const validatePrediction = (prediction) => {
  if (!prediction) return false;
  return prediction.length > 100; // Ensure meaningful content
};

export async function POST(request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing API key' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const images = [];
    const requiredImages = ['Left Palm', 'Right Palm', 'Left Thumb', 'Right Thumb'];

    // Process all required images
    for (const imageType of requiredImages) {
      const file = formData.get(imageType.replace(' ', '_').toLowerCase());
      if (!validateImage(file)) {
        return NextResponse.json(
          { error: `Invalid ${imageType} image provided` },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      images.push({
        type: imageType,
        data: Buffer.from(buffer).toString('base64'),
      });
    }

    // Initialize model with strict configuration
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.5,
        topP: 0.9,
      },
      systemInstruction: `You are a professional palmist. Provide:
      1. Complete analysis of all visible features
      2. Detailed future predictions with timeframes
      3. Minimum 200 words per analysis
      4. No placeholder text or incomplete thoughts
      5. Ensure all responses are self-contained`
    });

    const results = {};
    const analysisPrompts = {
      'Left Palm': `Provide a comprehensive analysis of this left palm covering:
      - Emotional patterns from heart line
      - Cognitive style from head line
      - Vitality indicators from life line
      - Relationship timeline for next 3 years
      - Health considerations`,
      
      'Right Palm': `Analyze this right palm in detail focusing on:
      - Career progression markers
      - Financial success indicators
      - Professional challenges
      - 5-year career forecast
      - Work-life balance advice`,

      'Left Thumb': `Examine this left thumb thoroughly:
      - Willpower and determination signs
      - Decision-making style
      - Upcoming life choices
      - Personal growth opportunities`,

      'Right Thumb': `Study this right thumb for:
      - Professional skills assessment
      - Leadership qualities
      - Career advancement timing
      - Workplace relationship advice`
    };

    // Process each image with retry logic
    for (const image of images) {
      let retries = 2;
      let prediction = '';
      
      while (retries > 0) {
        try {
          const result = await model.generateContent([
            { text: analysisPrompts[image.type] },
            { 
              inlineData: { 
                mimeType: 'image/jpeg',
                data: image.data 
              }
            }
          ]);
          
          prediction = (await result.response).text();
          if (validatePrediction(prediction)) break;
          
          retries--;
          if (retries === 0) {
            throw new Error('Incomplete prediction generated');
          }
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
        }
      }
      
      results[image.type.replace(' ', '').toLowerCase()] = prediction;
    }

    // Generate overall prediction with validation
    let overallPrediction = '';
    let overallRetries = 2;
    
    while (overallRetries > 0) {
      try {
        const result = await model.generateContent([
          { text: `Create a master life forecast combining:
          - Left Palm: ${results.leftpalm}
          - Right Palm: ${results.rightpalm}
          - Left Thumb: ${results.leftthumb}
          - Right Thumb: ${results.rightthumb}
          
          Structure as:
          1. 5-Year Life Timeline
          2. Career-Romance-Health Interactions
          3. Critical Decision Points
          4. Comprehensive Advice` }
        ]);
        
        overallPrediction = (await result.response).text();
        if (validatePrediction(overallPrediction)) break;
        
        overallRetries--;
      } catch (error) {
        overallRetries--;
        if (overallRetries === 0) throw error;
      }
    }
    
    results.overall = overallPrediction;

    // Final validation of all predictions
    if (!Object.values(results).every(validatePrediction)) {
      throw new Error('Incomplete predictions generated');
    }

    return NextResponse.json(results);
    
  } catch (error) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate complete predictions',
        details: 'Please try again with clearer hand images'
      },
      { status: 500 }
    );
  }
}