import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    // Parse request body
    const { prompt, chatHistory } = await req.json();
    if (!prompt || !Array.isArray(chatHistory)) {
      return new Response(
        JSON.stringify({ error: "Invalid request: 'prompt' and 'chatHistory' are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Gemini API
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Gemini API key is missing");
      return new Response(
        JSON.stringify({ error: "Server error: Gemini API key is not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Build prompt with context
    const context = "You are a visa expert chatbot. Provide accurate, concise answers related to visa queries only. Use the following chat history for context:\n" +
      chatHistory.map(msg => `${msg.role}: ${msg.content}`).join("\n");

    const fullPrompt = `${context}\nUser: ${prompt}\nAssistant:`;

    // Call Gemini API
    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    if (!responseText) {
      throw new Error("Empty response from Gemini API");
    }

    return new Response(
      JSON.stringify({ response: responseText }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Gemini API error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch Gemini response" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}