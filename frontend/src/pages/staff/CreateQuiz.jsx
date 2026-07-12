import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { aiService } from '../../lib/gemini.js';
import { Trash2, Sparkles, Save, ArrowLeft, Loader2, Image as ImageIcon, X } from 'lucide-react';

export default function CreateQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aiLoading, setAiLoading] = useState(false);
  const [creationMode, setCreationMode] = useState(id ? 'manual' : null);
  const [aiConfig, setAiConfig] = useState({ topic: '', count: 5 });
  const [error, setError] = useState('');
  const [quiz, setQuiz] = useState({
    title: '', description: '', topic: '', questions: [],
    startTime: '', endTime: '', duration: 30,
  });

  const fetchQuiz = async () => {
    try {
      const quizzes = await api.quizzes.getAll();
      const existing = quizzes.find(q => q._id === id);
      if (existing) {
        // Convert ISO dates to local datetime-local format
        const startTime = new Date(existing.startTime).toISOString().slice(0, 16);
        const endTime = new Date(existing.endTime).toISOString().slice(0, 16);
        setQuiz({ ...existing, startTime, endTime });
        setCreationMode('manual');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (id) {
      fetchQuiz();
    }
  }, [id]);

  const handleAddQuestion = () => {
    const newQuestion = {
      id: crypto.randomUUID(), text: '', options: ['', '', '', ''], correctAnswer: 0,
    };
    setQuiz({ ...quiz, questions: [...(quiz.questions || []), newQuestion] });
  };

  const handleRemoveQuestion = (index) => {
    const questions = [...(quiz.questions || [])];
    questions.splice(index, 1);
    setQuiz({ ...quiz, questions });
  };

  const handleQuestionChange = (index, field, value) => {
    const questions = [...(quiz.questions || [])];
    questions[index] = { ...questions[index], [field]: value };
    setQuiz({ ...quiz, questions });
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const questions = [...(quiz.questions || [])];
    questions[qIndex].options[oIndex] = value;
    setQuiz({ ...quiz, questions });
  };

  const handleImageUpload = (index, file) => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      handleQuestionChange(index, 'image', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAI = async () => {
    if (!aiConfig.topic) {
      setError('Please enter a topic first');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const aiQuestions = await aiService.generateQuiz(aiConfig.topic, aiConfig.count);
      const formatted = aiQuestions.map((q) => ({ id: crypto.randomUUID(), ...q }));
      setQuiz({ 
        ...quiz, 
        topic: aiConfig.topic,
        title: `Quiz on ${aiConfig.topic}`,
        questions: formatted 
      });
      setCreationMode('manual');
    } catch (error) {
      console.error(error);
      setError('AI generation failed');
      setTimeout(() => setError(''), 3000);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!quiz.title || !quiz.startTime || !quiz.endTime || !quiz.questions?.length) {
      setError('Please fill all required fields (Title, Times, and at least one question)');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setError('');
    try {
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      const finalQuiz = {
        ...quiz,
        createdBy: currentUser.id,
        department: currentUser.department,
      };
      await api.quizzes.save(finalQuiz);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  if (!creationMode && !id) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">How would you like to create your quiz?</h1>
          <p className="text-gray-500 text-lg">Choose between manual entry or AI-powered generation.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between max-w-md mx-auto">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <button
            onClick={() => setCreationMode('manual')}
            className="group p-8 bg-white rounded-2xl border-2 border-transparent hover:border-indigo-600 shadow-sm hover:shadow-xl transition-all text-left space-y-4"
          >
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Save className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Manual Creation</h2>
            <p className="text-gray-500">Write your own questions, options, and answers from scratch.</p>
          </button>

          <button
            onClick={() => setCreationMode('ai')}
            className="group p-8 bg-white rounded-2xl border-2 border-transparent hover:border-yellow-500 shadow-sm hover:shadow-xl transition-all text-left space-y-4"
          >
            <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center text-yellow-600 group-hover:bg-yellow-500 group-hover:text-white transition-colors">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">AI Generation</h2>
            <p className="text-gray-500">Generate a complete quiz instantly by just providing a topic and count.</p>
          </button>
        </div>
      </div>
    );
  }

  if (creationMode === 'ai' && !id) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 py-12">
        <button 
          onClick={() => setCreationMode(null)} 
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to selection
        </button>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
          </div>
        )}
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3.5 bg-indigo-50 rounded-2xl text-indigo-600 mb-2">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">AI Quiz Generator</h1>
            <p className="text-gray-500">Tell AI what you want to test your students on.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">Quiz Topic</label>
              <input 
                placeholder="e.g. React Hooks, Indian History, Quantum Physics" 
                className="w-full px-4 py-3 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none transition-all duration-200 text-gray-800 font-medium placeholder-slate-400 bg-slate-50/30 focus:bg-white" 
                value={aiConfig.topic} 
                onChange={e => setAiConfig({...aiConfig, topic: e.target.value})} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">Number of Questions</label>
              <input 
                type="number" 
                min="1" 
                max="20"
                className="w-full px-4 py-3 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none transition-all duration-200 text-gray-800 font-medium placeholder-slate-400 bg-slate-50/30 focus:bg-white" 
                value={aiConfig.count} 
                onChange={e => setAiConfig({...aiConfig, count: parseInt(e.target.value) || 1})} 
              />
            </div>

            <button 
              onClick={handleGenerateAI} 
              disabled={aiLoading || !aiConfig.topic}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-150 mt-2"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="animate-spin w-6 h-6" />
                  Generating Quiz...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  Generate Quiz
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 pt-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => id ? navigate('/') : setCreationMode(null)} 
            className="p-2.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors border border-slate-200 bg-white shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{id ? 'Edit Quiz' : 'Create Quiz'}</h1>
            <p className="text-sm text-slate-500 mt-1">{id ? 'Modify your quiz content and settings' : 'Set up a new quiz manually or edit generated questions'}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 text-lg font-bold">×</button>
        </div>
      )}

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-xl font-bold text-gray-900 border-b border-slate-100 pb-4">Quiz Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-2 space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">Quiz Title</label>
            <input 
              placeholder="Enter a descriptive title for the quiz" 
              className="w-full px-4 py-3 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none transition-all duration-200 text-gray-800 font-medium placeholder-slate-400 bg-slate-50/30 focus:bg-white" 
              value={quiz.title} 
              onChange={e => setQuiz({...quiz, title: e.target.value})} 
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">Description</label>
            <textarea 
              placeholder="Provide instructions or a brief description for students" 
              className="w-full px-4 py-3 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none transition-all duration-200 text-gray-800 font-medium placeholder-slate-400 bg-slate-50/30 focus:bg-white h-24 resize-none" 
              value={quiz.description} 
              onChange={e => setQuiz({...quiz, description: e.target.value})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">Topic</label>
            <input 
              placeholder="e.g. Mechanical Engineering, General Science" 
              className="w-full px-4 py-3 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none transition-all duration-200 text-gray-800 font-medium placeholder-slate-400 bg-slate-50/30 focus:bg-white" 
              value={quiz.topic} 
              onChange={e => setQuiz({...quiz, topic: e.target.value})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">Duration (Minutes)</label>
            <input 
              type="number" 
              placeholder="e.g. 30" 
              className="w-full px-4 py-3 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none transition-all duration-200 text-gray-800 font-medium placeholder-slate-400 bg-slate-50/30 focus:bg-white" 
              value={quiz.duration} 
              onChange={e => setQuiz({...quiz, duration: parseInt(e.target.value) || 0})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">Start Time</label>
            <input 
              type="datetime-local" 
              className="w-full px-4 py-3 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none transition-all duration-200 text-gray-800 font-medium bg-slate-50/30 focus:bg-white" 
              value={quiz.startTime} 
              onChange={e => setQuiz({...quiz, startTime: e.target.value})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">End Time</label>
            <input 
              type="datetime-local" 
              className="w-full px-4 py-3 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none transition-all duration-200 text-gray-800 font-medium bg-slate-50/30 focus:bg-white" 
              value={quiz.endTime} 
              onChange={e => setQuiz({...quiz, endTime: e.target.value})} 
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Questions</h2>
        {quiz.questions?.map((q, qIdx) => (
          <div key={q.id} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-lg font-bold text-gray-900">Question {qIdx + 1}</span>
              <button 
                onClick={() => handleRemoveQuestion(qIdx)} 
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                title="Remove Question"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">Question Text</label>
              <textarea 
                placeholder="Enter the question statement..." 
                className="w-full px-4 py-3 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl outline-none transition-all duration-200 text-gray-800 font-medium placeholder-slate-400 bg-slate-50/30 focus:bg-white h-20 resize-none" 
                value={q.text} 
                onChange={e => handleQuestionChange(qIdx, 'text', e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Options (Select the correct answer choice)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${
                    q.correctAnswer === oIdx
                      ? 'border-indigo-500 bg-indigo-50/30'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <label className="relative flex items-center justify-center cursor-pointer pl-2">
                      <input
                        type="radio"
                        name={`q-${qIdx}-correct`}
                        checked={q.correctAnswer === oIdx}
                        onChange={() => handleQuestionChange(qIdx, 'correctAnswer', oIdx)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        q.correctAnswer === oIdx
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}>
                        {q.correctAnswer === oIdx && (
                          <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                            <path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/>
                          </svg>
                        )}
                      </div>
                    </label>
                    <input
                      placeholder={`Option ${oIdx+1}`}
                      className="flex-1 bg-transparent border-0 outline-none text-gray-800 placeholder-slate-400 py-2 px-1 font-medium"
                      value={opt}
                      onChange={e => handleOptionChange(qIdx, oIdx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-all text-sm font-semibold text-gray-600 shadow-sm">
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  <span>{q.image ? 'Change Image' : 'Upload Question Image'}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => handleImageUpload(qIdx, e.target.files[0])} 
                  />
                </label>
                {q.image && (
                  <button 
                    onClick={() => handleQuestionChange(qIdx, 'image', '')}
                    className="text-red-500 hover:text-red-700 text-sm font-semibold flex items-center gap-1.5 px-3 py-2 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <X className="w-4 h-4" /> Remove
                  </button>
                )}
              </div>
              
              {q.image && (
                <div className="relative w-full max-w-sm group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner p-2">
                  <img src={q.image} alt="Preview" className="w-full h-48 object-contain rounded-lg" />
                </div>
              )}
            </div>
          </div>
        ))}
        
        <button 
          onClick={handleAddQuestion} 
          className="w-full py-4 border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl text-indigo-600 hover:bg-indigo-50/50 font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
        >
          <span className="text-xl">+</span> Add New Question
        </button>
      </div>

      <button 
        onClick={handleSave} 
        className="fixed bottom-8 right-8 bg-indigo-600 text-white px-8 py-3.5 rounded-full shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2.5 font-bold z-50 border border-indigo-500/10"
      >
        <Save className="w-5 h-5" /> Save Quiz
      </button>
    </div>
  );
}
