import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

// Using the environment variable if available, falling back to the placeholder
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBr5DnYOiRWgHeCBx8wqM_zWThwyElTw_I";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const aiService = {
  generateQuiz: async (topic, count = 5) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a quiz with ${count} multiple choice questions about "${topic}". Return only a JSON array of objects with fields: text (string), options (array of 4 strings), and correctAnswer (number, 0-3).`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.NUMBER }
            },
            required: ["text", "options", "correctAnswer"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  },

  getLearningContentStream: async (topic, onChunk) => {
    const response = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: `Explain the topic "${topic}" in detail for a student. Use markdown formatting. Include key concepts, examples, and a summary. Keep it concise but informative.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    let fullText = "";
    for await (const chunk of response) {
      const text = chunk.text || "";
      fullText += text;
      onChunk(fullText);
    }
    return fullText;
  },

  chatLearning: async (history, message, onChunk) => {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "You are a helpful learning assistant. Your goal is to help students learn about any topic they ask about. Provide clear, concise explanations and answer their follow-up questions. Use markdown for formatting.",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });

    const response = await chat.sendMessageStream({ message });
    let fullText = "";
    for await (const chunk of response) {
      const text = chunk.text || "";
      fullText += text;
      onChunk(fullText);
    }
    return fullText;
  }
};
