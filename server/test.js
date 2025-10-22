const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI('AIzaSyCErpXKlHiPzrOMmt-nZb0tzA-JjcOI-R4');

(async () => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-09-2025"
    });

    const result = await model.generateContent("Say 'Hello from Gemini 2.5 Flash Preview!'");
    console.log((await result.response).text());
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
