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
            className="group p-8 bg-white rounded-2xl border-2 border-transparent hover:border-purple-600 shadow-sm hover:shadow-xl transition-all text-left space-y-4"
          >
            <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
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
        <button onClick={() => setCreationMode(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to selection
        </button>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
          </div>
        )}
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-purple-50 rounded-xl text-purple-600 mb-2">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">AI Quiz Generator</h1>
            <p className="text-gray-500">Tell AI what you want to test your students on.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Topic</label>
              <input 
                placeholder="e.g. React Hooks, Indian History, Quantum Physics" 
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" 
                value={aiConfig.topic} 
                onChange={e => setAiConfig({...aiConfig, topic: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Questions</label>
              <input 
                type="number" 
                min="1" 
                max="20"
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" 
                value={aiConfig.count} 
                onChange={e => setAiConfig({...aiConfig, count: parseInt(e.target.value) || 1})} 
              />
            </div>

            <button 
              onClick={handleGenerateAI} 
              disabled={aiLoading || !aiConfig.topic}
              className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-100"
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
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => id ? navigate('/') : setCreationMode(null)} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft /></button>
        <h1 className="text-3xl font-bold">{id ? 'Edit Quiz' : 'Create Quiz'}</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Quiz Title" className="col-span-2 p-2 border rounded" value={quiz.title} onChange={e => setQuiz({...quiz, title: e.target.value})} />
          <textarea placeholder="Description" className="col-span-2 p-2 border rounded h-20" value={quiz.description} onChange={e => setQuiz({...quiz, description: e.target.value})} />
          <input placeholder="Topic" className="p-2 border rounded" value={quiz.topic} onChange={e => setQuiz({...quiz, topic: e.target.value})} />
          <input type="number" placeholder="Duration (min)" className="p-2 border rounded" value={quiz.duration} onChange={e => setQuiz({...quiz, duration: parseInt(e.target.value)})} />
          <input type="datetime-local" className="p-2 border rounded" value={quiz.startTime} onChange={e => setQuiz({...quiz, startTime: e.target.value})} />
          <input type="datetime-local" className="p-2 border rounded" value={quiz.endTime} onChange={e => setQuiz({...quiz, endTime: e.target.value})} />
        </div>
      </div>

      <div className="space-y-4">
        {quiz.questions?.map((q, qIdx) => (
          <div key={q.id} className="bg-white p-6 rounded-xl border space-y-4">
            <div className="flex justify-between">
              <span className="font-bold">Q{qIdx + 1}</span>
              <button onClick={() => handleRemoveQuestion(qIdx)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
            <textarea placeholder="Question text" className="w-full p-2 border rounded" value={q.text} onChange={e => handleQuestionChange(qIdx, 'text', e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              {q.options.map((opt, oIdx) => (
                <div key={oIdx} className="flex gap-2 items-center">
                  <input type="radio" checked={q.correctAnswer === oIdx} onChange={() => handleQuestionChange(qIdx, 'correctAnswer', oIdx)} />
                  <input placeholder={`Opt ${oIdx+1}`} className="flex-1 p-1 border rounded" value={opt} onChange={e => handleOptionChange(qIdx, oIdx, e.target.value)} />
                </div>
              ))}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors text-sm font-medium text-gray-600">
                  <ImageIcon className="w-4 h-4" />
                  <span>{q.image ? 'Change Image' : 'Add Image from Device'}</span>
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
                    className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                  >
                    <X className="w-4 h-4" /> Remove
                  </button>
                )}
              </div>
              
              {q.image && (
                <div className="relative w-full max-w-xs group">
                  <img src={q.image} alt="Preview" className="w-full h-40 object-contain rounded-lg border bg-gray-50" />
                </div>
              )}
            </div>
          </div>
        ))}
        <button onClick={handleAddQuestion} className="w-full py-3 border-2 border-dashed rounded-xl text-indigo-600 font-medium">+ Add Question</button>
      </div>

      <button onClick={handleSave} className="fixed bottom-8 right-8 bg-indigo-600 text-white px-8 py-3 rounded-full shadow-lg flex items-center gap-2">
        <Save /> Save Quiz
      </button>
    </div>
  );
}
