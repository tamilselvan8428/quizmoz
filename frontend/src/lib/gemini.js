import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { api } from "./api.js";

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

  generateQuizFromMaterials: async (materials, count = 5) => {
    try {
      const contents = [];
      
      materials.forEach(mat => {
        if (mat.fileContent) {
          const parts = mat.fileContent.split(',');
          const header = parts[0];
          const base64Data = parts[1];
          const mimeType = header.match(/data:(.*?);/)[1];
          contents.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          });
        }
      });

      contents.push(
        `Generate a quiz with ${count} multiple choice questions directly based on the provided study material(s). Return only a JSON array of objects with fields: text (string), options (array of 4 strings), and correctAnswer (number, 0-3).`
      );

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
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
    } catch (err) {
      console.error("Failed to generate quiz from materials:", err);
      throw err;
    }
  },

  generateQuizFromTextOrFile: async ({ fileContent, fileType, rawText, count = 5 }) => {
    try {
      const contents = [];
      
      if (fileContent) {
        const parts = fileContent.split(',');
        const base64Data = parts[1];
        const mime = fileType || parts[0].match(/data:(.*?);/)[1];
        contents.push({
          inlineData: {
            data: base64Data,
            mimeType: mime
          }
        });
      }
      
      if (rawText) {
        contents.push(`Provided Text/Book Content:\n${rawText}\n`);
      }
      
      contents.push(
        `Generate a quiz with ${count} multiple choice questions directly based on the provided study document/text. Return only a JSON array of objects with fields: text (string), options (array of 4 strings), and correctAnswer (number, 0-3).`
      );

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
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
    } catch (err) {
      console.error("Failed to generate quiz from text or file:", err);
      throw err;
    }
  },

  generateQuestionImage: async (questionText) => {
    try {
      const prompt = `A clean, professional, high-quality educational vector illustration representing the concept: "${questionText}". Simple style, suitable for a school or college quiz question, no text inside the image, clean dark background.`;
      
      const base64Image = await api.ai.generateImage(prompt);
      return base64Image;
    } catch (err) {
      console.error("Failed to generate question image:", err);
      return null;
    }
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
  },

  analyzeQuizResults: async (quizTitle, questions, answers, onChunk) => {
    const resultsSummary = questions.map((q, idx) => {
      const selected = answers[idx];
      const correct = q.correctAnswer;
      const isCorrect = selected === correct;
      return {
        question: q.text,
        options: q.options,
        correctOption: q.options[correct],
        selectedOption: selected === -1 ? "Skipped" : q.options[selected],
        isCorrect
      };
    });

    const prompt = `
You are an expert tutor. Analyze the student's performance on the quiz "${quizTitle}" and generate a detailed study guide.

Here are the student's answers:
${JSON.stringify(resultsSummary, null, 2)}

Please provide:
1. **Performance Analysis**: A brief, encouraging summary of what they did well and which concepts they got wrong or skipped.
2. **Question-by-Question Explanations**: For each question the student got wrong or skipped, state the question, the correct answer choice, and explain clearly and conceptually **why** that answer is correct.
3. **Concept Gaps**: Identify the core concepts they are struggling with based on their incorrect answers. Explain these concepts clearly and simply.
4. **Continuous Reading & Practice**: Provide structured, readable learning material in Markdown format for the topics they missed, including practical examples or code snippets if relevant, so they can continue reading and bridge their gaps.

Be supportive, educational, and thorough. Use clear markdown formatting.
`;

    const response = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are an advanced learning assistant. Provide highly educational, clear, and actionable feedback and study guides based on quiz results.",
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
  }
};
