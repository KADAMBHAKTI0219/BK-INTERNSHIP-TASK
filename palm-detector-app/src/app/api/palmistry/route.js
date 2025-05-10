import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request) {
  try {
    // Verify API key is available
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Missing Gemini API key in server configuration');
    }

    const formData = await request.formData();
    console.log('Received FormData keys:', Array.from(formData.keys()));
    const images = {
      leftPalm: formData.get('left_palm'),
      rightPalm: formData.get('right_palm'),
      leftThumb: formData.get('left_thumb'),
      rightThumb: formData.get('right_thumb'),
    };

    // Validate images
    for (const [key, file] of Object.entries(images)) {
      if (!file || file.size < 1024) {
        throw new Error(`Invalid ${key.replace(/([A-Z])/g, ' $1')} image`);
      }
      console.log(`File ${key}: Size=${file.size}, Type=${file.type}`);
    }

    // Initialize model with better configuration
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.7,
      },
      systemInstruction: `You are a professional palm reader. Analyze hand images and provide:
      1. Clear descriptions of visible features
      2. Practical interpretations
      3. Any limitations due to image quality
      4. Structured responses with sections`,
    });

    // Process images and get analysis
    const results = {};

    for (const [key, file] of Object.entries(images)) {
      try {
        const buffer = await file.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');
        console.log(`Processing ${key}: Buffer size=${buffer.byteLength}, MIME=${file.type}`);

        const prompt = `Analyze this ${key.replace(/([A-Z])/g, ' $1')} image for palmistry features:
        - Describe all visible lines and marks
        - Provide traditional interpretations
        - Note any unclear areas`;

        const result = await model.generateContent([
          { text: prompt },
          {
            inlineData: {
              mimeType: file.type,
              data: base64Image,
            },
          },
        ]);

        const responseText = (await result.response).text();
        console.log(`Analysis for ${key}:`, responseText);
        results[key] = responseText;
      } catch (error) {
        console.error(`Error processing ${key}:`, error.message, error.stack);
        results[key] = `Analysis failed for ${key.replace(/([A-Z])/g, ' $1')}`;
      }
    }

    // Generate overall reading
    try {
      const overallPrompt = `Create a comprehensive palm reading:
      Left Palm: ${results.leftPalm}
      Right Palm: ${results.rightPalm}
      Left Thumb: ${results.leftThumb}
      Right Thumb: ${results.rightThumb}
      
      Structure your response with:
      1. Personality Insights
      2. Life Path Suggestions
      3. Relationship Patterns
      4. Health Indicators`;

      const overallResult = await model.generateContent([{ text: overallPrompt }]);
      const overallText = (await overallResult.response).text();
      console.log('Overall analysis:', overallText);
      results.overall = overallText;
    } catch (error) {
      console.error('Error generating overall analysis:', error.message, error.stack);
      results.overall = 'Could not generate complete reading';
    }

    return NextResponse.json({
      success: true,
      data: {
        overallReading: results.overall,
        leftPalm: results.leftPalm,
        rightPalm: results.rightPalm,
        leftThumb: results.leftThumb,
        rightThumb: results.rightThumb,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('API Error:', error.message, error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message.includes('quota')
          ? 'API quota exceeded. Please try again later.'
          : error.message || 'Analysis failed',
        suggestion: error.message.includes('quota')
          ? 'Upgrade your API plan or wait until quota resets'
          : 'Check your images and try again',
      },
      { status: error.message.includes('quota') ? 429 : 400 }
    );
  }
}