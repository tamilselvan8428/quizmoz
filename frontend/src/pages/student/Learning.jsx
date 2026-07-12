import { useState, useEffect, useRef } from 'react';
import { aiService } from '../../lib/gemini.js';
import { api } from '../../lib/api.js';
import { BookOpen, Sparkles, Loader2, CheckCircle2, XCircle, PlayCircle, Plus, History, Send, ArrowLeft, Trash2 } from 'lucide-react';
import Markdown from 'react-markdown';

export default function Learning() {
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [topic, setTopic] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [practiceQuiz, setPracticeQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const chatEndRef = useRef(null);

  const fetchSessions = async (studentId) => {
    try {
      const data = await api.learning.getAll(studentId);
      setSessions(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    setUser(currentUser);
    if (currentUser.id) {
      fetchSessions(currentUser.id);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, streamingText]);

  const startNewSession = async (e) => {
    e.preventDefault();
    if (!topic || !user) return;
    
    setLoading(true);
    const newSession = {
      studentId: user.id,
      topic: topic,
      messages: [{ role: 'user', text: `Tell me about ${topic}` }],
    };

    setCurrentSession(newSession);
    setStreamingText('Thinking...');

    try {
      const response = await aiService.chatLearning([], `Tell me about ${topic}`, (text) => {
        setStreamingText(text);
      });

      const updatedSession = {
        ...newSession,
        messages: [
          ...newSession.messages,
          { role: 'model', text: response }
        ],
      };

      const savedSession = await api.learning.save(updatedSession);
      setCurrentSession(savedSession);
      fetchSessions(user.id);
      
      // Generate a practice quiz in the background
      aiService.generateQuiz(topic, 3).then(quiz => {
        setPracticeQuiz(quiz.map((q) => ({ id: crypto.randomUUID(), ...q })));
        setQuizAnswers(new Array(quiz.length).fill(-1));
      });

    } catch (error) {
      console.error(error);
      setError('Failed to start learning session');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
      setStreamingText('');
      setTopic('');
      document.getElementById('new-learning-modal')?.classList.add('hidden');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input || !currentSession || !user || loading) return;

    const userMessage = { role: 'user', text: input };
    const updatedMessages = [...currentSession.messages, userMessage];
    
    setCurrentSession({ ...currentSession, messages: updatedMessages });
    setInput('');
    setLoading(true);
    setStreamingText('Thinking...');

    try {
      const response = await aiService.chatLearning(currentSession.messages, input, (text) => {
        setStreamingText(text);
      });

      const finalSession = {
        ...currentSession,
        messages: [...updatedMessages, { role: 'model', text: response }],
      };

      const savedSession = await api.learning.save(finalSession);
      setCurrentSession(savedSession);
      fetchSessions(user.id);
    } catch (error) {
      console.error(error);
      setError('Failed to send message');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  };

  const deleteSession = async () => {
    if (!selectedSession) return;
    setError('');
    try {
      await api.learning.delete(selectedSession._id);
      if (user) fetchSessions(user.id);
      if (currentSession?._id === selectedSession._id) setCurrentSession(null);
      setShowDeleteConfirm(false);
      setSelectedSession(null);
      setSuccess('Learning session deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (currentSession) {
    return (
      <div className="max-w-5xl mx-auto h-[calc(100vh-12rem)] flex flex-col gap-6 text-white">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => {
              setCurrentSession(null);
              setPracticeQuiz(null);
              setShowResults(false);
            }}
            className="flex items-center gap-2 text-slate-400 hover:text-white font-semibold transition-colors bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs"
          >
            <ArrowLeft className="w-4 h-4" /> Back to History
          </button>
          <h1 className="text-xl font-bold text-white">Learning: {currentSession.topic}</h1>
          <div className="w-24" /> {/* Spacer */}
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden">
          <div className="flex-1 bg-slate-900 border border-slate-800/80 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {currentSession.messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-[#2059a1] text-white rounded-tr-none' 
                      : 'bg-slate-950 border border-slate-850 text-slate-250 rounded-tl-none'
                  }`}>
                    <div className="prose prose-sm max-w-none prose-indigo text-slate-200">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] p-4 rounded-2xl bg-slate-950 border border-slate-850 text-slate-200 rounded-tl-none">
                    <div className="prose prose-sm max-w-none text-slate-200">
                      <Markdown>{streamingText}</Markdown>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t border-slate-850 flex gap-2 bg-slate-950/40">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a follow-up question..."
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] outline-none text-white font-medium"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input}
                className="bg-[#2059a1] text-white p-3 rounded-xl hover:bg-[#1a4b87] transition-all disabled:opacity-50 shadow-lg shadow-[#2059a1]/10 flex items-center justify-center"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </div>

          {practiceQuiz && (
            <div className="w-80 hidden lg:block overflow-y-auto scrollbar-thin">
              <div className="bg-slate-900 border border-slate-800 text-white p-6 rounded-3xl shadow-2xl space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <PlayCircle className="w-6 h-6 text-yellow-500 fill-yellow-500/10" />
                  <h2 className="text-xl font-bold">Practice Quiz</h2>
                </div>
                
                <div className="space-y-8">
                  {practiceQuiz.map((q, qIdx) => (
                    <div key={q.id} className="space-y-3">
                      <p className="text-sm font-semibold text-slate-200">{qIdx + 1}. {q.text}</p>
                      <div className="space-y-2">
                        {q.options.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            disabled={showResults}
                            onClick={() => {
                              const newAns = [...quizAnswers];
                              newAns[qIdx] = oIdx;
                              setQuizAnswers(newAns);
                            }}
                            className={`w-full text-left p-3 rounded-xl text-sm transition-all flex items-center justify-between border ${
                              quizAnswers[qIdx] === oIdx
                                ? 'bg-[#2059a1]/20 border-[#2059a1] text-white'
                                : 'bg-slate-950/80 border-slate-850 hover:bg-slate-850 text-slate-350'
                            } ${
                              showResults && oIdx === q.correctAnswer ? 'bg-green-950/60 border-green-500 text-green-300 font-bold' : ''
                            } ${
                              showResults && quizAnswers[qIdx] === oIdx && oIdx !== q.correctAnswer ? 'bg-red-950/60 border-red-500 text-red-300 font-bold' : ''
                            }`}
                          >
                            <span>{opt}</span>
                            {showResults && oIdx === q.correctAnswer && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 ml-2" />}
                            {showResults && quizAnswers[qIdx] === oIdx && oIdx !== q.correctAnswer && <XCircle className="w-4 h-4 text-red-400 shrink-0 ml-2" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {!showResults ? (
                    <button
                      onClick={() => setShowResults(true)}
                      className="w-full bg-[#ecbf21] text-slate-950 py-3 rounded-xl font-extrabold hover:bg-[#c59e13] transition-colors shadow-lg shadow-yellow-500/10"
                    >
                      Check Answers
                    </button>
                  ) : (
                    <div className="text-center pt-4 border-t border-slate-800">
                      <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">Your Score</p>
                      <p className="text-3xl font-black text-white">
                        {quizAnswers.filter((a, i) => a === practiceQuiz[i].correctAnswer).length} / {practiceQuiz.length}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-white tracking-tight">Learning Hub</h1>
        <p className="text-slate-400 text-lg">Start a new learning journey or continue where you left off</p>
      </div>

      {error && (
        <div className="bg-red-955/50 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl flex items-center justify-between max-w-md mx-auto">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-450 hover:text-red-300">×</button>
        </div>
      )}

      {success && (
        <div className="bg-green-955/50 border border-green-900/50 text-green-400 px-4 py-3 rounded-xl flex items-center justify-between max-w-md mx-auto">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-450 hover:text-green-300">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Create New Learning Box */}
        <div className="aspect-square bg-slate-900/40 rounded-3xl border-2 border-dashed border-slate-800 p-8 flex flex-col items-center justify-center text-center group hover:border-[#2059a1] hover:bg-slate-900/60 transition-all cursor-pointer shadow-sm hover:shadow-2xl hover:-translate-y-1"
             onClick={() => document.getElementById('new-learning-modal')?.classList.remove('hidden')}>
          <div className="w-16 h-16 bg-[#2059a1]/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all border border-[#2059a1]/20 text-[#2059a1] group-hover:text-[#ecbf21]">
            <Plus className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">Create a Learning</h3>
          <p className="text-sm text-slate-400 mt-2">Start learning anything with AI chatbot</p>
        </div>

        {/* History Sessions */}
        {sessions.map(session => (
          <div 
            key={session._id}
            onClick={() => setCurrentSession(session)}
            className="aspect-square bg-slate-900/40 rounded-3xl border border-slate-800/80 p-8 flex flex-col justify-between group hover:shadow-2xl hover:border-yellow-500/20 hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden text-white"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-[#2059a1] opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-slate-400 group-hover:text-yellow-400 transition-colors" />
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSession(session);
                    setShowDeleteConfirm(true);
                  }}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800/40 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-xl font-bold text-white line-clamp-2">{session.topic}</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <History className="w-3 h-3 text-slate-600" />
                <span>Last active {new Date(session.lastUpdatedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#2059a1] group-hover:text-yellow-400 font-bold uppercase tracking-wider transition-colors">
                Continue Learning <ArrowLeft className="w-3 h-3 rotate-180" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Learning Modal */}
      <div id="new-learning-modal" className="fixed inset-0 bg-black/65 backdrop-blur-sm hidden flex items-center justify-center z-[60] p-4 animate-fade-in">
        <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl max-w-md w-full p-8 space-y-6 animate-scale-in">
          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span className="w-2.5 h-6 bg-yellow-500 rounded-full inline-block" />
              New Learning
            </h2>
            <button 
              onClick={() => {
                document.getElementById('new-learning-modal')?.classList.add('hidden');
                setTopic('');
              }}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={startNewSession} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">What do you want to learn?</label>
              <input
                type="text"
                required
                autoFocus
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Quantum Physics, History of Rome..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !topic}
              className="w-full bg-[#2059a1] text-white py-3 rounded-xl font-bold hover:bg-[#1a4b87] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#2059a1]/10 mt-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Start Learning
            </button>
          </form>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/25 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white text-center mb-2">Delete Session</h2>
            <p className="text-slate-350 text-center mb-8 text-sm leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">{selectedSession?.topic}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedSession(null);
                  setError('');
                }}
                className="flex-1 px-4 py-2.5 border border-slate-800 text-slate-300 rounded-xl hover:bg-slate-850 transition-colors font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={deleteSession}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold text-sm shadow-lg shadow-red-600/15"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
