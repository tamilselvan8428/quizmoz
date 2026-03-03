/***********************************************************************
 Unified Quiz Generator (Deep Content Mode + Gemini + Fallback)
************************************************************************/
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
(async () => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Say 'Hello from Gemini!'");
    console.log((await result.response).text());
  } catch (err) {
    console.error('❌ Gemini Test Failed:', err.message);
  }
})();
// ========== Helper to parse Gemini text output ==========
function parseGeminiResponse(text, subtopic = 'General', numQuestions = 5) {
  if (!text || typeof text !== 'string') return { questions: [] };

  const blocks = text
    .split(/\n(?=Q\d+[:.]|\d+\.)|Q\d+[:.]/i)
    .map(s => s.trim())
    .filter(Boolean);

  const questions = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    if (/^[A-D][\)\.]/i.test(lines[0])) continue;
    const questionText = lines[0].replace(/^Q\d+[:.]?\s*/i, '').trim();

    const options = [];
    let correctAnswer = null;
    let explanation = '';

    for (const line of lines.slice(1)) {
      const optMatch = line.match(/^(\*?)([A-D])[\)\.]\s*(.*)/i);
      if (optMatch) {
        const isStar = !!optMatch[1];
        const label = optMatch[2].toUpperCase();
        const txt = optMatch[3].trim();
        options.push({ label, text: txt });
        if (isStar) correctAnswer = label;
        continue;
      }
      const explMatch = line.match(/^Explanation[:\-]\s*(.*)/i);
      if (explMatch) explanation = explMatch[1].trim();
    }

    if (options.length >= 2) {
      if (!correctAnswer && options.length > 0) correctAnswer = options[0].label;
      questions.push({
        question: questionText,
        options,
        correctAnswer,
        explanation,
        subtopic
      });
    }
    if (questions.length >= numQuestions) break;
  }
  return { questions: questions.slice(0, numQuestions) };
}

// ========== File Extraction ==========
async function extractTextFromFile(buffer, fileType) {
  try {
    if (fileType === 'application/pdf') {
      const data = await pdfParse(buffer);
      return data.text;
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (fileType === 'text/plain') {
      return buffer.toString('utf-8');
    }
    throw new Error('Unsupported file type');
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error('Failed to process document');
  }
}

// ========== AI Subtopic & Content Flow ==========
async function generateSubtopicsAI(topic, numSubtopics = 5) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
List ${numSubtopics} focused subtopics under "${topic}".
Use short, specific phrases (no numbering, one per line).
`;
  const result = await model.generateContent(prompt);
  const text = (await result.response).text();
  return text.split('\n').map(t => t.trim()).filter(Boolean).slice(0, numSubtopics);
}

async function generateSubtopicContentAI(topic, subtopic) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `
Explain "${subtopic}" under the topic "${topic}" in 120–160 words.
Include what it is, how it works, and one example.
`;
  const result = await model.generateContent(prompt);
  return (await result.response).text().trim();
}

async function generateQuizFromContentAI(topic, subtopic, content, numQuestions = 2) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `
From the content below about "${subtopic}" (in "${topic}"), create ${numQuestions} MCQs.

Rules:
- 4 options (A–D)
- Mark correct with *
- Add a short explanation after each
- Avoid generic or obvious questions

Content:
${content}

Format:
Q1: question text
A) option
*B) option
C) option
D) option
Explanation: ...
`;
  const result = await model.generateContent(prompt);
  return (await result.response).text().trim();
}

async function generateDeepQuizWithGemini(topic, totalQuestions = 10) {
  const maxSubtopics = Math.min(6, Math.ceil(totalQuestions / 2));
  const subtopics = await generateSubtopicsAI(topic, maxSubtopics);
  const perSub = Math.ceil(totalQuestions / Math.max(1, subtopics.length));
  const sections = [];

  for (const sub of subtopics) {
    try {
      const content = await generateSubtopicContentAI(topic, sub);
      const quizText = await generateQuizFromContentAI(topic, sub, content, perSub);
      const parsed = parseGeminiResponse(quizText, sub, perSub);
      sections.push({ subtopic: sub, content, questions: parsed.questions || [] });
    } catch (err) {
      console.error(`❌ Subtopic "${sub}" failed:`, err.message);
    }
  }

  const merged = sections.flatMap(s => s.questions);
  return {
    title: `AI Quiz: ${topic}`,
    description: `Generated from AI-created study material on ${topic}`,
    subtopics: sections.map(s => s.subtopic),
    sections,
    questions: merged.slice(0, totalQuestions)
  };
}

// ========== Fallback ==========
async function generateFallbackQuiz(topic, numQuestions = 10) {
  const questions = [];
  for (let i = 1; i <= numQuestions; i++) {
    questions.push({
      question: `Fallback question ${i} on ${topic}?`,
      options: [
        { label: 'A', text: 'Fallback Option 1' },
        { label: 'B', text: 'Fallback Option 2' },
        { label: 'C', text: 'Fallback Option 3' },
        { label: 'D', text: 'Fallback Option 4' }
      ],
      correctAnswer: 'A',
      explanation: 'Placeholder fallback explanation.',
      subtopic: 'General'
    });
  }
  return { questions };
}

// ========== Main Export ==========
async function generateQuizFromText(text, options = {}) {
  if (!text || typeof text !== 'string' || text.trim().length === 0)
    throw new Error('Text input is required');

  const numQuestions = Math.min(parseInt(options.numQuestions) || 10, 50);
  const topic = (options.topics || text).toString().trim();

  try {
    const deepQuiz = await generateDeepQuizWithGemini(topic, numQuestions);

    if (deepQuiz.questions?.length >= Math.ceil(numQuestions / 2)) {
      if (deepQuiz.questions.length < numQuestions) {
        const needed = numQuestions - deepQuiz.questions.length;
        const gem = await generateQuizWithGemini(topic, needed);
        deepQuiz.questions = [...deepQuiz.questions, ...(gem.questions || [])].slice(0, numQuestions);
      }
      return deepQuiz;
    }

    // fallback to direct Gemini
    const gemini = await generateQuizWithGemini(topic, numQuestions);
    if (gemini.questions?.length >= 1) return gemini;

    const fallback = await generateFallbackQuiz(topic, numQuestions);
    return fallback;
  } catch (err) {
    console.error('Generation failed, returning fallback:', err);
    const fallback = await generateFallbackQuiz(topic, numQuestions);
    return fallback;
  }
}

// ========== Simple Gemini Quiz ==========
async function generateQuizWithGemini(topic, numQuestions = 10) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
Create ${numQuestions} multiple-choice questions about "${topic}".
Each question:
- Has 4 options (A–D)
- Mark correct with *
- Provide 1-sentence explanation.
`;
  const result = await model.generateContent(prompt);
  const text = (await result.response).text();
  return parseGeminiResponse(text, topic, numQuestions);
}

// ========== Exports ==========
module.exports = {
  extractTextFromFile,
  generateQuizFromText
};
