import { GoogleGenerativeAI } from "@google/generative-ai";

// Utility to add delay between API calls to avoid rate limits
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request) {
  try {
    const formData = await request.formData();
    const images = [];

    // Collect all four images (Left Palm, Right Palm, Left Thumb, Right Thumb)
    for (let i = 0; i < 4; i++) {
      const file = formData.get(`image_${i}`);
      if (!file) {
        console.error(`Image_${i} is missing in FormData`);
        return new Response(
          JSON.stringify({ error: `Missing image_${i} in request` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const buffer = await file.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
      images.push({
        type: file.name.replace('.jpg', '').replace('_', ' '),
        data: base64Data,
        mimeType: file.type,
      });
    }

    console.log('Images received:', images.map((img) => ({
      type: img.type,
      dataLength: img.data.length,
    })));

    // Validate API key
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    // Initialize the Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Define prompts for each image type
    const prompts = {
      'Left Palm': `
        You are an expert palm reader with 50 years of experience analyzing palms.
        Carefully examine this left palm image and provide a detailed future prediction.
        
        The user is asking: "What does this left palm reveal about my future?".
        
        Provide a 3-4 paragraph reading covering:
        - Life path and major upcoming events
        - Relationships and emotional journey
        - Career and financial prospects
        - Health considerations
        
        Use traditional palmistry terms but explain them in simple language.
        Make the reading mystical yet believable, with a positive tone.
        Include specific observations from the palm image in your analysis.
        If the image is unclear, respond with "Unable to analyze: Image is not clear enough."
      `,
      'Right Palm': `
        You are an expert palm reader with 50 years of experience analyzing palms.
        Carefully examine this right palm image and provide a detailed future prediction.
        
        The user is asking: "What does this right palm reveal about my future?".
        
        Provide a 3-4 paragraph reading covering:
        - Life path and major upcoming events
        - Relationships and emotional journey
        - Career and financial prospects
        - Health considerations
        
        Use traditional palmistry terms but explain them in simple language.
        Make the reading mystical yet believable, with a positive tone.
        Include specific observations from the palm image in your analysis.
        If the image is unclear, respond with "Unable to analyze: Image is not clear enough."
      `,
      'Left Thumb': `
        You are an expert palm reader with 50 years of experience analyzing palms.
        Carefully examine this left thumb image and provide a detailed future prediction.
        
        The user is asking: "What does this left thumb reveal about my personality and will?".
        
        Provide a 2-3 paragraph reading focusing on:
        - Personality traits and willpower
        - How these traits influence future decisions
        
        Use traditional palmistry terms but explain them in simple language.
        Make the reading mystical yet believable, with a positive tone.
        Include specific observations from the thumb image in your analysis.
        If the image is unclear, respond with "Unable to analyze: Image is not clear enough."
      `,
      'Right Thumb': `
        You are an expert palm reader with 50 years of experience analyzing palms.
        Carefully examine this right thumb image and provide a detailed future prediction.
        
        The user is asking: "What does this right thumb reveal about my personality and will?".
        
        Provide a 2-3 paragraph reading focusing on:
        - Personality traits and willpower
        - How these traits influence future decisions
        
        Use traditional palmistry terms but explain them in simple language.
        Make the reading mystical yet believable, with a positive tone.
        Include specific observations from the thumb image in your analysis.
        If the image is unclear, respond with "Unable to analyze: Image is not clear enough."
      `,
    };

    const results = {};

    // Process each image with the Gemini API
    for (const image of images) {
      const prompt = prompts[image.type];
      if (!prompt) {
        throw new Error(`No prompt found for image type: ${image.type}`);
      }

      console.log(`Calling Gemini API for ${image.type}`);
      const result = await model.generateContent({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: image.data,
                mimeType: image.mimeType,
              },
            },
          ],
        }],
      });

      console.log(`Raw Gemini API response for ${image.type}:`, result);

      let text;
      try {
        text = result.response?.text?.();
        if (!text) {
          throw new Error('No text in response');
        }
      } catch (error) {
        console.error(`Failed to get text for ${image.type}:`, error);
        text = 'Unable to analyze this image. Please ensure the image is clear and try again.';
      }

      results[image.type.replace(' ', '').toLowerCase()] = text;
      await delay(1000); // Avoid rate limits
    }

    // Generate an overall reading
    const overallPrompt = `
      You are an expert palm reader with 50 years of experience analyzing palms.
      Based on the following individual readings:
      - Left Palm: ${results.leftPalm}
      - Right Palm: ${results.rightPalm}
      - Left Thumb: ${results.leftThumb}
      - Right Thumb: ${results.rightThumb}
      
      Provide a comprehensive overall reading combining all these aspects.
      Highlight any significant patterns or contradictions across the palms and thumbs.
      Provide a 3-4 paragraph reading covering:
      - Overall life path and major upcoming events
      - Relationships and emotional journey
      - Career and financial prospects
      - Health considerations
      
      Use traditional palmistry terms but explain them in simple language.
      Make the reading mystical yet believable, with a positive tone.
      If the individual readings are insufficient, respond with a general positive reading based on typical palmistry insights.
    `;

    console.log('Calling Gemini API for overall summary');
    const overallResult = await model.generateContent({
      contents: [{
        parts: [{ text: overallPrompt }],
      }],
    });

    console.log('Raw Gemini API response for overall:', overallResult);

    let overallText;
    try {
      overallText = overallResult.response?.text?.();
      if (!overallText) {
        throw new Error('No text in overall response');
      }
    } catch (error) {
      console.error('Failed to get overall text:', error);
      overallText = 'Unable to generate overall reading due to incomplete data. However, your palms suggest a bright future filled with opportunities and growth.';
    }

    results.overall = overallText;

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing palmistry:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process palmistry reading',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}