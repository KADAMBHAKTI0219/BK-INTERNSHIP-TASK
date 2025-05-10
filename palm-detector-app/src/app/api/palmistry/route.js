import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Utility function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Utility function for retry with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes('429') && attempt < maxRetries) {
        const retryDelay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Retry ${attempt}/${maxRetries} after ${retryDelay}ms due to 429 error`);
        await delay(retryDelay);
        continue;
      }
      throw error;
    }
  }
};

export async function POST(request) {
  try {
    // Verify API key
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

    // Initialize model
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.7,
      },
      systemInstruction: `You are a professional palm reader. Analyze hand images and provide structured responses with sections. For individual hand parts (except right palm), include:
      1. Clear descriptions of visible features
      2. Practical interpretations
      3. Any limitations due to image quality
      For the right palm, only describe the visible lines (e.g., "Visible lines: Deep head line, forked heart line").`,
    });

    // Process images with retry logic
    const results = {};
    const requiredKeys = ['leftPalm', 'rightPalm', 'leftThumb', 'rightThumb'];
    let successfulAnalyses = 0;

    for (const key of requiredKeys) {
      try {
        const file = images[key];
        const buffer = await file.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');
        console.log(
          `Processing ${key}: Buffer size=${buffer.byteLength}, MIME=${file.type}, Base64 length=${base64Image.length}`
        );

        // Special prompt for rightPalm to only describe visible lines
        const prompt =
          key === 'rightPalm'
            ? `Analyze this Right Palm image for palmistry features:
            - Describe only the visible lines (e.g., "Visible lines: Deep head line, forked heart line")
            - Do not provide interpretations or limitations`
            : `Analyze this ${key.replace(/([A-Z])/g, ' $1')} image for palmistry features:
            - Describe all visible lines and marks
            - Provide traditional interpretations
            - Note any unclear areas`;

        const result = await retryWithBackoff(async () => {
          console.log(`Sending Gemini API request for ${key}`);
          const response = await model.generateContent([
            { text: prompt },
            {
              inlineData: {
                mimeType: file.type,
                data: base64Image,
              },
            },
          ]);
          const text = (await response.response).text();
          console.log(`Received Gemini API response for ${key}: ${text.substring(0, 100)}...`);
          return text;
        });

        results[key] = result;
        successfulAnalyses++;
      } catch (error) {
        console.error(`Error processing ${key}:`, error.message);
        results[key] = `Analysis failed for ${key.replace(/([A-Z])/g, ' $1')}: ${error.message}`;
      }
    }

    // Generate overall reading only if all individual analyses succeeded
    try {
      if (successfulAnalyses === requiredKeys.length) {
        const overallPrompt = `Create a comprehensive palm reading based on the following analyses:
        Left Palm: ${results.leftPalm}
        Right Palm: ${results.rightPalm}
        Left Thumb: ${results.leftThumb}
        Right Thumb: ${results.rightThumb}
        
        Structure your response with:
        1. Personality Insights
        2. Life Path Suggestions
        3. Relationship Patterns
        4. Health Indicators`;

        results.overall = await retryWithBackoff(async () => {
          console.log('Sending Gemini API request for overall reading');
          const response = await model.generateContent([{ text: overallPrompt }]);
          const text = (await response.response).text();
          console.log(`Received Gemini API response for overall: ${text.substring(0, 100)}...`);
          return text;
        });

        successfulAnalyses++;
      } else {
        results.overall = 'Overall reading not generated due to incomplete analysis of individual parts.';
      }
    } catch (error) {
      console.error('Error generating overall analysis:', error.message);
      results.overall = `Could not generate overall reading: ${error.message}`;
    }

    // Return partial results if at least one analysis succeeded
    const hasSuccessfulAnalysis = successfulAnalyses > 0;

    return NextResponse.json({
      success: hasSuccessfulAnalysis,
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
    console.error('API Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message.includes('quota')
          ? 'API quota exceeded. Please try again later.'
          : error.message || 'Analysis failed',
        suggestion: error.message.includes('quota')
          ? 'Generate a new API key at https://console.cloud.google.com/ or wait until quota resets'
          : 'Check your images and try again',
      },
      { status: error.message.includes('quota') ? 429 : 400 }
    );
  }
}