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
      throw new Error('GEMINI_API_KEY is not set');
    }

    const formData = await request.formData();
    const images = [];

    // Process all 4 images with validation
    for (let i = 0; i < 4; i++) {
      const file = formData.get(`image_${i}`);
      if (!validateImage(file)) {
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

    // Initialize model
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro-latest',
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 0.9,
      },
      systemInstruction:
        'You are a professional palmistry expert. Provide detailed but concise readings based on the palm images. Focus on key lines, mounts, and shapes. Keep responses between 80-120 words.',
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
          results[image.type.replace(' ', '').toLowerCase()] = `Invalid image type: ${image.type}`;
          continue;
        }

        const result = await model.generateContent([
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: image.data,
            },
          },
        ]);

        const response = result.response.text();
        results[image.type.replace(' ', '').toLowerCase()] = response || `No analysis for ${image.type}`;
      } catch (error) {
        console.error(`Error processing ${image.type}:`, error);
        results[image.type.replace(' ', '').toLowerCase()] = `Could not analyze ${image.type}. Please ensure clear image.`;
      }
    }

    // Generate overall reading
    try {
      const overallModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
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

      const overallResult = await overallModel.generateContent(overallPrompt);
      results.overall = overallResult.response.text() || 'Could not generate overall reading.';
    } catch (error) {
      console.error('Error generating overall reading:', error);
      results.overall = 'Could not generate overall reading. Please try again.';
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error processing palmistry:', error);
    return NextResponse.json(
      { error: 'Failed to process palmistry reading', details: error.message },
      { status: 500 }
    );
  }
}