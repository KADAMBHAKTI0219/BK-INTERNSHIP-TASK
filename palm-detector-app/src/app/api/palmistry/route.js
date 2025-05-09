import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Google Generative AI with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Utility to add delay between API calls to avoid rate limits
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request) {
  try {
    // Validate API key
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    // Parse FormData
    const formData = await request.formData();
    const images = [];

    for (let i = 0; i < 4; i++) {
      const file = formData.get(`image_${i}`);
      if (!file) {
        console.error(`Image_${i} is missing in FormData`);
        return Response.json(
          { error: `Missing image_${i} in request` },
          { status: 400 }
        );
      }
      const buffer = await file.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
      if (!base64Data) {
        throw new Error(`Failed to convert image_${i} to base64`);
      }
      images.push({
        type: file.name.replace('.jpg', '').replace('_', ' '),
        data: base64Data,
      });
    }

    // Log image data for debugging
    console.log('Images received:', images.map((img) => ({
      type: img.type,
      dataLength: img.data.length,
    })));

    // Initialize Gemini model with the updated model name
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompts = {
      'Left Palm': 'Analyze this left palm image for palmistry. Provide insights about the heart line, head line, life line, and any notable mounts or markings. Keep the response under 100 words.',
      'Right Palm': 'Analyze this right palm image for palmistry. Focus on the fate line, sun line, and any differences from the left palm. Keep the response under 100 words.',
      'Left Thumb': 'Analyze this left thumb image for palmistry. Comment on the flexibility, shape, and phalanges. Keep the response under 80 words.',
      'Right Thumb': 'Analyze this right thumb image for palmistry. Note any differences from the left thumb and what they might signify. Keep the response under 80 words.',
    };

    const results = {};
    for (const image of images) {
      const prompt = prompts[image.type];
      if (!prompt) {
        throw new Error(`No prompt found for image type: ${image.type}`);
      }
      const imageParts = [{
        inlineData: {
          data: image.data,
          mimeType: 'image/jpeg',
        },
      }];

      console.log(`Calling Gemini API for ${image.type}`);
      const result = await model.generateContent([prompt, ...imageParts]);
      if (!result.response || !result.response.text) {
        throw new Error(`Invalid response from Gemini API for ${image.type}`);
      }
      const text = result.response.text();
      results[image.type.replace(' ', '').toLowerCase()] = text;
      await delay(1000); // 1-second delay to avoid rate limits
    }

    const overallPrompt = `
      Based on the following palmistry readings:
      - Left Palm: ${results.leftPalm}
      - Right Palm: ${results.rightPalm}
      - Left Thumb: ${results.leftThumb}
      - Right Thumb: ${results.rightThumb}
      
      Provide a comprehensive overall reading combining all these aspects.
      Highlight any significant patterns or contradictions.
      Keep the response under 150 words.
    `;

    // Use the same model for the overall summary
    const overallModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log('Calling Gemini API for overall summary');
    const overallResult = await overallModel.generateContent(overallPrompt);
    if (!overallResult.response || !overallResult.response.text) {
      throw new Error('Invalid response from Gemini API for overall summary');
    }
    results.overall = overallResult.response.text();

    return Response.json(results);
  } catch (error) {
    console.error('Error processing palmistry:', error);
    return Response.json(
      { error: 'Failed to process palmistry reading', details: error.message },
      { status: 500 }
    );
  }
}