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
  const [aiSourceType, setAiSourceType] = useState('topic'); // 'topic' or 'doc'
  const [uploadedFile, setUploadedFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [generateImages, setGenerateImages] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
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

  const handleDocUpload = (file) => {
    if (!file) return;
    const allowedExtensions = ['.pdf', '.txt'];
    const isAllowed = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!isAllowed) {
      setError('Unsupported file format. Please upload a PDF or TXT file, or copy and paste the document text below.');
      setTimeout(() => setError(''), 5000);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError(`File is too large (max 20MB)`);
      setTimeout(() => setError(''), 3000);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedFile({
        fileContent: reader.result,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAI = async () => {
    if (aiSourceType === 'topic' && !aiConfig.topic) {
      setError('Please enter a topic first');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (aiSourceType === 'doc' && !uploadedFile && !pastedText) {
      setError('Please upload a document or paste some text content first');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setAiLoading(true);
    setAiStatusMessage('Generating questions...');
    setError('');
    try {
      let aiQuestions = [];
      if (aiSourceType === 'topic') {
        aiQuestions = await aiService.generateQuiz(aiConfig.topic, aiConfig.count);
      } else {
        aiQuestions = await aiService.generateQuizFromTextOrFile({
          fileContent: uploadedFile?.fileContent,
          fileType: uploadedFile?.fileType,
          rawText: pastedText,
          count: aiConfig.count
        });
      }

      let formatted = aiQuestions.map((q) => ({ id: crypto.randomUUID(), ...q }));

      if (generateImages && formatted.length > 0) {
        setAiStatusMessage('Generating illustrative AI images...');
        const imagePromises = formatted.map(async (q) => {
          try {
            const imgBase64 = await aiService.generateQuestionImage(q.text);
            return { ...q, image: imgBase64 || undefined };
          } catch (e) {
            console.error("Failed to generate image for question:", q.text, e);
            return q;
          }
        });
        formatted = await Promise.all(imagePromises);
      }
      
      const quizTitle = aiConfig.topic 
        ? `Quiz on ${aiConfig.topic}` 
        : (uploadedFile ? `Quiz from ${uploadedFile.fileName}` : 'AI Generated Quiz');

      setQuiz({ 
        ...quiz, 
        topic: aiConfig.topic || 'General',
        title: quizTitle,
        questions: formatted 
      });
      setCreationMode('manual');
    } catch (error) {
      console.error(error);
      setError('AI quiz generation failed');
      setTimeout(() => setError(''), 3000);
    } finally {
      setAiLoading(false);
      setAiStatusMessage('');
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
      setShowSuccessAnimation(true);
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  if (showSuccessAnimation) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#7c3aed] via-[#4c1d95] to-[#10b981]/50 flex flex-col items-center justify-center z-[999] overflow-hidden animate-fade-in">
        {/* Confetti Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(60)].map((_, i) => {
            const randomX = Math.random() * 100;
            const randomSize = Math.random() * 8 + 6;
            const randomDelay = Math.random() * 2;
            const randomDuration = Math.random() * 2.5 + 2;
            const randomColorClass = [
              'bg-red-500', 'bg-yellow-400', 'bg-blue-500', 'bg-green-500', 'bg-pink-500', 'bg-purple-500', 'bg-orange-500'
            ][Math.floor(Math.random() * 7)];
            
            return (
              <div
                key={i}
                className={`absolute rounded-full opacity-80 ${randomColorClass}`}
                style={{
                  width: `${randomSize}px`,
                  height: `${randomSize}px`,
                  left: `${randomX}%`,
                  top: `-10px`,
                  animation: `fallAndRotate ${randomDuration}s linear ${randomDelay}s infinite`
                }}
              />
            );
          })}
        </div>

        {/* Animated Card */}
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-3xl p-10 max-w-md w-full mx-4 shadow-2xl text-center space-y-6 animate-scale-in text-white">
          <div className="relative flex justify-center">
            {/* Outer spinning ring */}
            <div className="w-24 h-24 rounded-full border-4 border-dashed border-[#10b981] animate-spin [animation-duration:8s] flex items-center justify-center" />
            {/* Inner pulsing checkmark circle */}
            <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 animate-pulse">
              <svg className="w-8 h-8 text-white stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tight animate-pulse">Success!</h2>
            <p className="text-[#10b981] font-bold text-lg">Quiz Created Successfully</p>
            <p className="text-slate-400 text-sm">Redirecting you to the dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!creationMode && !id) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-12 text-white animate-fade-in">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black text-white">How would you like to create your quiz?</h1>
          <p className="text-slate-400 text-lg">Choose between manual entry or AI-powered generation.</p>
        </div>

        {error && (
          <div className="bg-red-955/50 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl flex items-center justify-between max-w-md mx-auto">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-450 hover:text-red-300 font-bold">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <button
            onClick={() => setCreationMode('manual')}
            className="group p-8 bg-slate-900/40 rounded-3xl border border-slate-800 hover:border-[#7c3aed] hover:bg-slate-900/60 shadow-sm hover:shadow-2xl transition-all text-left space-y-4"
          >
            <div className="w-16 h-16 bg-[#7c3aed]/10 rounded-2xl flex items-center justify-center text-[#7c3aed] group-hover:bg-[#7c3aed] group-hover:text-white transition-all border border-[#7c3aed]/10">
              <Save className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">Manual Creation</h2>
            <p className="text-slate-400">Write your own questions, options, and answers from scratch.</p>
          </button>

          <button
            onClick={() => setCreationMode('ai')}
            className="group p-8 bg-slate-900/40 rounded-3xl border border-slate-800 hover:border-yellow-500 hover:bg-slate-900/60 shadow-sm hover:shadow-2xl transition-all text-left space-y-4"
          >
            <div className="w-16 h-16 bg-yellow-550/10 rounded-2xl flex items-center justify-center text-yellow-500 group-hover:bg-yellow-500 group-hover:text-slate-950 transition-all border border-yellow-500/10">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">AI Generation</h2>
            <p className="text-slate-400">Generate a complete quiz instantly by just providing a topic and count.</p>
          </button>
        </div>
      </div>
    );
  }

  if (creationMode === 'ai' && !id) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 py-12 text-white animate-fade-in">
        <button 
          onClick={() => setCreationMode(null)} 
          className="flex items-center gap-2 text-slate-400 hover:text-white font-semibold transition-colors bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to selection
        </button>
        
        {error && (
          <div className="bg-red-955/50 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-455 hover:text-red-300 font-bold">×</button>
          </div>
        )}
        
        <div className="bg-slate-900 border border-slate-800/80 p-8 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3.5 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-yellow-500 mb-2">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-white">AI Quiz Generator</h1>
            <p className="text-slate-450">Tell AI what you want to test your students on.</p>
          </div>

          <div className="flex gap-4 border-b border-slate-850">
            <button
              onClick={() => setAiSourceType('topic')}
              className={`pb-3 px-4 font-bold text-sm transition-colors relative whitespace-nowrap cursor-pointer ${
                aiSourceType === 'topic' ? 'text-yellow-450 border-b-2 border-yellow-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Generate by Topic
            </button>
            <button
              onClick={() => setAiSourceType('doc')}
              className={`pb-3 px-4 font-bold text-sm transition-colors relative whitespace-nowrap cursor-pointer ${
                aiSourceType === 'doc' ? 'text-yellow-450 border-b-2 border-yellow-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Generate by Document / Text
            </button>
          </div>

          <div className="space-y-5">
            {aiSourceType === 'topic' ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Quiz Topic</label>
                <input 
                  placeholder="e.g. React Hooks, Indian History, Quantum Physics" 
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all duration-200" 
                  value={aiConfig.topic} 
                  onChange={e => setAiConfig({...aiConfig, topic: e.target.value})} 
                />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-455 uppercase mb-1">Upload Reference Document</label>
                  {!uploadedFile ? (
                    <div className="w-full flex items-center justify-center">
                      <label className="w-full flex flex-col items-center px-4 py-6 bg-slate-950 text-slate-400 rounded-xl border border-slate-800 border-dashed cursor-pointer hover:border-[#7c3aed] transition-colors text-center">
                        <Save className="w-8 h-8 text-slate-500 mb-2 group-hover:scale-115 transition-transform" />
                        <span className="text-sm font-semibold">Select a PDF or TXT file</span>
                        <span className="text-xs text-slate-500 mt-1">Maximum file size: 20MB</span>
                        <input
                          type="file"
                          accept=".pdf,.txt"
                          className="hidden"
                          onChange={(e) => handleDocUpload(e.target.files[0])}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-sm font-semibold text-white truncate max-w-xs">{uploadedFile.fileName}</span>
                        <span className="text-xs text-[#10b981] font-bold uppercase shrink-0">Loaded</span>
                      </div>
                      <button
                        onClick={() => setUploadedFile(null)}
                        className="text-red-450 hover:text-red-300 p-1 rounded-lg hover:bg-slate-850 transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-455 uppercase mb-1">Or Paste Text / Book Content</label>
                  <textarea
                    rows="6"
                    placeholder="Paste a chapter, key notes, or book text here..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all duration-200 resize-none"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-455 uppercase mb-1">Quiz Topic / Title (Optional)</label>
                  <input 
                    placeholder="e.g. Chapter 1, Chemical Reactions" 
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all duration-200" 
                    value={aiConfig.topic} 
                    onChange={e => setAiConfig({...aiConfig, topic: e.target.value})} 
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Number of Questions</label>
              <input 
                type="number" 
                min="1" 
                max="20"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all duration-200" 
                value={aiConfig.count} 
                onChange={e => setAiConfig({...aiConfig, count: parseInt(e.target.value) || 1})} 
              />
            </div>

            <div className="flex items-center gap-3 py-2 bg-slate-950/40 px-4 rounded-xl border border-slate-800/60">
              <input
                type="checkbox"
                id="generateImages"
                checked={generateImages}
                onChange={(e) => setGenerateImages(e.target.checked)}
                className="w-4.5 h-4.5 text-[#7c3aed] focus:ring-[#7c3aed] bg-slate-950 border-slate-800 rounded accent-[#7c3aed] cursor-pointer"
              />
              <label htmlFor="generateImages" className="text-sm font-semibold text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                Generate illustrative AI images for questions <span className="text-[10px] bg-[#7c3aed]/10 text-[#a78bfa] border border-[#7c3aed]/20 px-2 py-0.5 rounded-full font-bold uppercase">Imagen 3</span>
              </label>
            </div>

            <button 
              onClick={handleGenerateAI} 
              disabled={aiLoading || (aiSourceType === 'topic' ? !aiConfig.topic : (!uploadedFile && !pastedText))}
              className="w-full bg-[#7c3aed] text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#7c3aed]/10 mt-2 cursor-pointer"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="animate-spin w-6 h-6" />
                  {aiStatusMessage || 'Generating Quiz...'}
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
    <div className="max-w-4xl mx-auto space-y-8 pb-32 pt-6 text-white">
      <div className="flex items-center justify-between border-b border-slate-850 pb-5 animate-fade-in">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => id ? navigate('/') : setCreationMode(null)} 
            className="p-2.5 hover:bg-slate-855 text-slate-400 rounded-xl transition-colors border border-slate-800 bg-slate-900 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white">{id ? 'Edit Quiz' : 'Create Quiz'}</h1>
            <p className="text-xs text-slate-450 mt-1">{id ? 'Modify your quiz content and settings' : 'Set up a new quiz manually or edit generated questions'}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-955/50 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-455 hover:text-red-300 text-lg font-bold">×</button>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800/80 p-8 rounded-3xl shadow-2xl space-y-6 animate-fade-in-up">
        <h2 className="text-xl font-bold text-white border-b border-slate-850 pb-4">Quiz Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Quiz Title</label>
            <input 
              placeholder="Enter a descriptive title for the quiz" 
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all duration-200" 
              value={quiz.title} 
              onChange={e => setQuiz({...quiz, title: e.target.value})} 
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Description</label>
            <textarea 
              placeholder="Provide instructions or a brief description for students" 
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all duration-200 h-24 resize-none" 
              value={quiz.description} 
              onChange={e => setQuiz({...quiz, description: e.target.value})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Topic</label>
            <input 
              placeholder="e.g. Mechanical Engineering, General Science" 
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all duration-200" 
              value={quiz.topic} 
              onChange={e => setQuiz({...quiz, topic: e.target.value})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Duration (Minutes)</label>
            <input 
              type="number" 
              placeholder="e.g. 30" 
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all duration-200" 
              value={quiz.duration} 
              onChange={e => setQuiz({...quiz, duration: parseInt(e.target.value) || 0})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Start Time</label>
            <input 
              type="datetime-local" 
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium transition-all duration-200 [color-scheme:dark]" 
              value={quiz.startTime} 
              onChange={e => setQuiz({...quiz, startTime: e.target.value})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-455 uppercase mb-1">End Time</label>
            <input 
              type="datetime-local" 
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium transition-all duration-200 [color-scheme:dark]" 
              value={quiz.endTime} 
              onChange={e => setQuiz({...quiz, endTime: e.target.value})} 
            />
          </div>
        </div>
      </div>

      <div className="space-y-6 animate-fade-in-up">
        <h2 className="text-xl font-bold text-white">Questions</h2>
        {quiz.questions?.map((q, qIdx) => (
          <div key={q.id} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl space-y-6 hover:shadow-2xl transition-all">
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <span className="text-lg font-bold text-white">Question {qIdx + 1}</span>
              <button 
                onClick={() => handleRemoveQuestion(qIdx)} 
                className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800/45 rounded-xl transition-all"
                title="Remove Question"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-450 uppercase mb-1">Question Text</label>
              <textarea 
                placeholder="Enter the question statement..." 
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#7c3aed] text-white outline-none font-medium placeholder-slate-500 transition-all duration-200 h-20 resize-none" 
                value={q.text} 
                onChange={e => handleQuestionChange(qIdx, 'text', e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-450 uppercase mb-2">Options (Select the correct answer choice)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${
                    q.correctAnswer === oIdx
                      ? 'border-yellow-500/60 bg-yellow-500/5'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
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
                          ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
                          : 'border-slate-600 bg-slate-950 hover:border-slate-500'
                      }`}>
                        {q.correctAnswer === oIdx && (
                          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20">
                            <path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/>
                          </svg>
                        )}
                      </div>
                    </label>
                    <input
                      placeholder={`Option ${oIdx+1}`}
                      className="flex-1 bg-transparent border-0 outline-none text-white placeholder-slate-550 py-2 px-1 font-semibold"
                      value={opt}
                      onChange={e => handleOptionChange(qIdx, oIdx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-2 border-t border-slate-850 space-y-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-850 transition-all text-xs font-bold text-slate-350 shadow-sm">
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
                    className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-1.5 px-3 py-2 hover:bg-slate-850 rounded-xl transition-all"
                  >
                    <X className="w-4 h-4" /> Remove
                  </button>
                )}
              </div>
              
              {q.image && (
                <div className="relative w-full max-w-sm group overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-inner p-2">
                  <img src={q.image} alt="Preview" className="w-full h-48 object-contain rounded-lg" />
                </div>
              )}
            </div>
          </div>
        ))}
        
        <button 
          onClick={handleAddQuestion} 
          className="w-full py-4 border-2 border-dashed border-slate-800 hover:border-[#7c3aed] hover:bg-[#7c3aed]/5 rounded-2xl text-[#7c3aed] font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
        >
          <span className="text-xl">+</span> Add New Question
        </button>
      </div>

      <button 
        onClick={handleSave} 
        className="fixed bottom-8 right-8 bg-[#10b981] text-slate-950 px-8 py-3.5 rounded-full shadow-2xl hover:bg-[#059669] hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2.5 font-black z-50 border border-yellow-500/10"
      >
        <Save className="w-5 h-5 text-slate-950" /> Save Quiz
      </button>
    </div>
  );
}
