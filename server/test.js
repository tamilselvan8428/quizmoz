const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI('AIzaSyDj4wI-aA4R1gf1IQp7AdCIAhwGkG77krI');

(async () => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const result = await model.generateContent("Say 'Hello from Gemini 2.5 Flash Preview!'");
    console.log((await result.response).text());
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
