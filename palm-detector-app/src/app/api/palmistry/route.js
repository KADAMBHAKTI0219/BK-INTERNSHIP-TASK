import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const formData = await request.formData();
    const images = [];

    // Process all 4 images
    for (let i = 0; i < 4; i++) {
      const file = formData.get(`image_${i}`);
      if (!file) {
        return new Response(JSON.stringify({ 
          error: `Missing image_${i} in request` 
        }), { 
          status: 400 
        });
      }

      const buffer = await file.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
      images.push({
        type: file.name.replace('.jpg', '').replace('_', ' '),
        data: base64Data,
      });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro-latest",
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.9,
      }
    });

    // Enhanced prompts for better responses
    const prompts = {
      'Left Palm': `Analyze this left palm image for detailed palmistry. Focus on:
      - Heart line (emotional nature)
      - Head line (intellectual capacity)
      - Life line (vitality and health)
      - Any special marks or mounts
      Provide specific insights in 80-100 words.`,
      
      'Right Palm': `Analyze this right palm image for detailed palmistry. Focus on:
      - Fate line (career path)
      - Sun line (success and fame)
      - Differences from left palm
      - Mount development
      Provide specific insights in 80-100 words.`,
      
      'Left Thumb': `Analyze this left thumb image for detailed palmistry. Examine:
      - Flexibility and shape
      - Phalanges proportions
      - Any special markings
      - What it reveals about willpower
      Provide specific insights in 60-80 words.`,
      
      'Right Thumb': `Analyze this right thumb image for detailed palmistry. Examine:
      - Differences from left thumb
      - Shape characteristics
      - What it reveals about logic vs intuition
      Provide specific insights in 60-80 words.`
    };

    const results = {};
    
    // Process each image individually
    for (const image of images) {
      const prompt = prompts[image.type];
      if (!prompt) continue;

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: image.data
                }
              }
            ]
          }
        ]
      });

      const response = result.response;
      if (response && response.text) {
        results[image.type.replace(' ', '').toLowerCase()] = response.text();
      }
    }

    // Generate overall reading
    const overallModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
    const overallPrompt = `Combine these palmistry readings into a comprehensive analysis:
    Left Palm: ${results.leftPalm || 'No data'}
    Right Palm: ${results.rightPalm || 'No data'}
    Left Thumb: ${results.leftThumb || 'No data'}
    Right Thumb: ${results.rightThumb || 'No data'}
    
    Provide a 150-200 word overall reading that:
    - Identifies key personality traits
    - Highlights potential strengths/weaknesses
    - Notes any interesting patterns
    - Suggests life path insights
    - Maintains a positive, constructive tone`;

    const overallResult = await overallModel.generateContent(overallPrompt);
    if (overallResult.response && overallResult.response.text) {
      results.overall = overallResult.response.text();
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing palmistry:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process palmistry reading',
      details: error.message 
    }), { 
      status: 500 
    });
  }
}