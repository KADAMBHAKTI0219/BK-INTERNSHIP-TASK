import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const images = [];
    
    for (let i = 0; i < 4; i++) {
      const file = formData.get(`image_${i}`);
      if (file) {
        const buffer = await file.arrayBuffer();
        images.push({
          type: file.name.replace('.jpg', '').replace('_', ' '),
          data: Buffer.from(buffer).toString('base64')
        });
      }
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    const prompts = {
      'Left Palm': 'Analyze this left palm image for palmistry. Provide insights about the heart line, head line, life line, and any notable mounts or markings. Keep the response under 100 words.',
      'Right Palm': 'Analyze this right palm image for palmistry. Focus on the fate line, sun line, and any differences from the left palm. Keep the response under 100 words.',
      'Left Thumb': 'Analyze this left thumb image for palmistry. Comment on the flexibility, shape, and phalanges. Keep the response under 80 words.',
      'Right Thumb': 'Analyze this right thumb image for palmistry. Note any differences from the left thumb and what they might signify. Keep the response under 80 words.'
    };

    const results = {};
    for (const image of images) {
      const prompt = prompts[image.type];
      const imageParts = [{
        inlineData: {
          data: image.data,
          mimeType: 'image/jpeg'
        }
      }];

      const result = await model.generateContent([prompt, ...imageParts]);
      const text = result.response.text();
      results[image.type.replace(' ', '').toLowerCase()] = text;
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

    const overallModel = genAI.getGenerativeModel({ model: "gemini-pro" });
    const overallResult = await overallModel.generateContent(overallPrompt);
    results.overall = overallResult.response.text();

    return Response.json(results);
  } catch (error) {
    console.error('Error processing palmistry:', error);
    return Response.json(
      { error: 'Failed to process palmistry reading' },
      { status: 500 }
    );
  }
}