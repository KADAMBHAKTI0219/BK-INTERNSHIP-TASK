import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import sharp from 'sharp'; // For image processing to detect blurriness

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Utility function to validate image
const validateImage = (file) => {
  if (!file) return false;
  if (file.size === 0) return false;
  if (!file.type.startsWith('image/')) return false;
  return true;
};

// Utility function to detect blurriness using edge detection
const isImageBlurry = async (buffer) => {
  try {
    const { data, info } = await sharp(buffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let edgeSum = 0;
    const width = info.width;
    const height = info.height;

    // Simple edge detection (Laplacian-like)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const pixel = data[idx];
        const neighbors = [
          data[(y - 1) * width + x],
          data[(y + 1) * width + x],
          data[y * width + x - 1],
          data[y * width + x + 1],
        ];
        const edge = Math.abs(
          4 * pixel - neighbors[0] - neighbors[1] - neighbors[2] - neighbors[3]
        );
        edgeSum += edge;
      }
    }

    const edgeAverage = edgeSum / ((width - 2) * (height - 2));
    // Threshold for blurriness (adjust as needed)
    return edgeAverage < 20; // Lower values indicate blurrier images
  } catch (error) {
    console.error('Error checking blurriness:', error);
    return false; // Assume not blurry if check fails
  }
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

    // Process all 4 images with validation and blur detection
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
      const isBlurry = await isImageBlurry(Buffer.from(buffer));
      const base64Data = Buffer.from(buffer).toString('base64');

      images.push({
        type: file.name.replace('.jpg', '').replace('_', ' '),
        data: base64Data,
        isBlurry,
      });
    }
    console.log('Images processed:', images.map((img) => ({ type: img.type, blurry: img.isBlurry })));

    // Initialize model
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 0.9,
      },
      systemInstruction:
        'You are a professional palmistry expert. Provide detailed but concise readings based on palm images, even if they are slightly blurry. Focus on visible key lines, mounts, shapes, and any discernible features. If details are unclear, provide a general analysis based on what is visible. Keep responses between 80-120 words.',
    });

    // Define prompts for each image type, adjusted for blurry images
    const prompts = {
      'Left Palm': `Analyze this left palm image, even if slightly blurry. Focus on:
      1. Heart line (emotional nature, relationships, if visible)
      2. Head line (intellect, thinking style, if visible)
      3. Life line (vitality, major life events, if visible)
      4. Mount development (areas of strength, if discernible)
      5. Any special marks or patterns (if clear)
      Provide a concise 100-word reading, generalizing if details are unclear.`,

      'Right Palm': `Analyze this right palm image, even if slightly blurry. Focus on:
      1. Fate line (career path, destiny, if visible)
      2. Sun line (success, recognition, if visible)
      3. Differences from left palm (if discernible)
      4. Mount of Jupiter/Saturn/Apollo (if clear)
      5. Overall hand shape and flexibility (if visible)
      Provide a concise 100-word reading, generalizing if details are unclear.`,

      'Left Thumb': `Analyze this left thumb, even if slightly blurry. Examine:
      1. Flexibility and angle (if visible)
      2. Phalanges proportions (will vs logic, if discernible)
      3. Shape (conic, spatulate, etc., if clear)
      4. Any markings or special features (if visible)
      Provide a concise 80-word reading, generalizing if details are unclear.`,

      'Right Thumb': `Analyze this right thumb, even if slightly blurry. Examine:
      1. Differences from left thumb (if discernible)
      2. Flexibility and angle (if visible)
      3. Shape characteristics (if clear)
      4. What it reveals about decision-making (if visible)
      Provide a concise 80-word reading, generalizing if details are unclear.`,
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

        console.log(`Generating content for ${image.type}${image.isBlurry ? ' (blurry)' : ''}`);
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
        results[image.type.replace(' ', '').toLowerCase()] = image.isBlurry
          ? `${text} (Note: Image was blurry, analysis may be less detailed.)`
          : text;
        console.log(`Success for ${image.type}: ${text.substring(0, 50)}...`);
      } catch (error) {
        console.error(`Error processing ${image.type}:`, error.message);
        results[image.type.replace(' ', '').toLowerCase()] = `Could not analyze ${image.type}. ${
          image.isBlurry ? 'Image is too blurry.' : 'Please ensure clear image.'
        }`;
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
      5. Maintains a positive, constructive tone
      If some readings are missing or based on blurry images, generalize based on available data.`;

      const overallResult = await model.generateContent(overallPrompt);
      const overallText = await overallResult.response.text();
      results.overall = overallText || 'Could not generate overall reading due to missing data.';
      console.log(`Overall reading generated: ${overallText.substring(0, 50)}...`);
    } catch (error) {
      console.error('Error generating overall reading:', error.message);
      const hasBlurryImages = images.some((img) => img.isBlurry);
      const fallbackText = `Overall reading based on available data:
      - Left Palm: ${results.leftpalm || 'No data'}
      - Right Palm: ${results.rightpalm || 'No data'}
      - Left Thumb: ${results.leftthumb || 'No data'}
      - Right Thumb: ${results.rightthumb || 'No data'}
      ${
        hasBlurryImages
          ? 'Some images were blurry, limiting analysis detail. Please capture clearer images.'
          : 'Please ensure clear images for a detailed analysis.'
      }`;
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