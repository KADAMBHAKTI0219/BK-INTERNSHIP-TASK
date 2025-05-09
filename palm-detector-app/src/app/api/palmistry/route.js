import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Utility function to validate image
const validateImage = (file) => {
  if (!file) return false;
  if (file.size === 0) return false;
  if (!file.type.startsWith('image/')) return false;
  return true;
};

export async function POST(request) {
  try {
    // Validate API key
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not set');
      return NextResponse.json(
        { error: 'Server configuration error: Missing API key' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const images = [];

    // Process all 4 images with validation
    console.log('Processing formData entries');
    for (let i = 0; i < 4; i++) {
      const file = formData.get(`image_${i}`);
      if (!validateImage(file)) {
        console.error(`Invalid image_${i}:`, file);
        return NextResponse.json(
          { error: `Invalid image_${i} provided` },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');

      images.push({
        type: file.name.replace('.jpg', '').replace('_', ' '),
        data: base64Data,
      });
    }
    console.log('Images processed:', images.map((img) => img.type));

    // Initialize model
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 0.9,
      },
      systemInstruction:
        'You are a professional palmistry expert. Provide detailed but concise readings based on palm images. Focus on key lines, mounts, and shapes. Keep responses between 80-120 words.',
    });

    // Define prompts for each image type
    const prompts = {
      'Left Palm': `Analyze this left palm image professionally. Focus on:
      1. Heart line (emotional nature, relationships)
      2. Head line (intellect, thinking style)
      3. Life line (vitality, major life events)
      4. Mount development (areas of strength)
      5. Any special marks or patterns
      Provide a concise 100-word reading.`,

      'Right Palm': `Analyze this right palm image professionally. Focus on:
      1. Fate line (career path, destiny)
      2. Sun line (success, recognition)
      3. Differences from left palm
      4. Mount of Jupiter/Saturn/Apollo
      5. Overall hand shape and flexibility
      Provide a concise 100-word reading.`,

      'Left Thumb': `Analyze this left thumb professionally. Examine:
      1. Flexibility and angle
      2. Phalanges proportions (will vs logic)
      3. Shape (conic, spatulate, etc.)
      4. Any markings or special features
      Provide a concise 80-word reading.`,

      'Right Thumb': `Analyze this right thumb professionally. Examine:
      1. Differences from left thumb
      2. Flexibility and angle
      3. Shape characteristics
      4. What it reveals about decision-making
      Provide a concise 80-word reading.`,
    };

    const results = {};

    // Process each image
    for (const image of images) {
      try {
        const prompt = prompts[image.type];
        if (!prompt) {
          console.warn(`No prompt for image type: ${image.type}`);
          results[image.type.replace(' ', '').toLowerCase()] = `Invalid image type: ${image.type}`;
          continue;
        }

        console.log(`Generating content for ${image.type}`);
        const result = await model.generateContent([
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: image.data,
            },
          },
        ]);

        const text = await result.response.text();
        if (!text) {
          throw new Error(`Empty response for ${image.type}`);
        }
        results[image.type.replace(' ', '').toLowerCase()] = text;
        console.log(`Success for ${image.type}: ${text.substring(0, 50)}...`);
      } catch (error) {
        console.error(`Error processing ${image.type}:`, error.message);
        results[image.type.replace(' ', '').toLowerCase()] = `Could not analyze ${image.type}. Please ensure clear image.`;
      }
    }

    // Generate overall reading with fallback
    try {
      console.log('Generating overall reading');
      const overallPrompt = `Combine these palmistry readings into a comprehensive analysis:
      Left Palm: ${results.leftpalm || 'No data'}
      Right Palm: ${results.rightpalm || 'No data'}
      Left Thumb: ${results.leftthumb || 'No data'}
      Right Thumb: ${results.rightthumb || 'No data'}
      
      Provide a 150-200 word overall reading that:
      1. Identifies key personality traits
      2. Highlights potential strengths/weaknesses
      3. Notes any interesting patterns
      4. Suggests life path insights
      5. Maintains a positive, constructive tone`;

      const overallResult = await model.generateContent(overallPrompt);
      const overallText = await overallResult.response.text();
      results.overall = overallText || 'Could not generate overall reading due to missing data.';
      console.log(`Overall reading generated: ${overallText.substring(0, 50)}...`);
    } catch (error) {
      console.error('Error generating overall reading:', error.message);
      // Fallback: Summarize available readings
      const fallbackText = `Overall reading based on available data:
      - Left Palm: ${results.leftpalm || 'No data'}
      - Right Palm: ${results.rightpalm || 'No data'}
      - Left Thumb: ${results.leftthumb || 'No data'}
      - Right Thumb: ${results.rightthumb || 'No data'}
      Please ensure clear images for a detailed analysis.`;
      results.overall = fallbackText;
    }

    console.log('Final results:', Object.keys(results));
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error processing palmistry:', error.message);
    return NextResponse.json(
      { error: 'Failed to process palmistry reading', details: error.message },
      { status: 500 }
    );
  }
}