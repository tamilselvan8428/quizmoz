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
      <div className="max-w-5xl mx-auto h-[calc(100vh-12rem)] flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => {
              setCurrentSession(null);
              setPracticeQuiz(null);
              setShowResults(false);
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> Back to History
          </button>
          <h1 className="text-xl font-bold text-gray-900">Learning: {currentSession.topic}</h1>
          <div className="w-24" /> {/* Spacer */}
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden">
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {currentSession.messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-gray-100 text-gray-800 rounded-tl-none'
                  }`}>
                    <div className="prose prose-sm max-w-none prose-indigo dark:prose-invert">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] p-4 rounded-2xl bg-gray-100 text-gray-800 rounded-tl-none">
                    <div className="prose prose-sm max-w-none prose-indigo">
                      <Markdown>{streamingText}</Markdown>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t border-gray-100 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a follow-up question..."
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input}
                className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
              </button>
            </form>
          </div>

          {practiceQuiz && (
            <div className="w-80 hidden lg:block overflow-y-auto">
              <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl space-y-6">
                <div className="flex items-center gap-2">
                  <PlayCircle className="w-6 h-6 text-indigo-300" />
                  <h2 className="text-xl font-bold">Practice Quiz</h2>
                </div>
                
                <div className="space-y-8">
                  {practiceQuiz.map((q, qIdx) => (
                    <div key={q.id} className="space-y-3">
                      <p className="text-sm font-medium text-indigo-100">{qIdx + 1}. {q.text}</p>
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
                            className={`w-full text-left p-3 rounded-lg text-sm transition-all flex items-center justify-between ${
                              quizAnswers[qIdx] === oIdx
                                ? 'bg-indigo-600 border border-indigo-400'
                                : 'bg-indigo-800/50 border border-transparent hover:bg-indigo-800'
                            } ${
                              showResults && oIdx === q.correctAnswer ? 'bg-green-600 border-green-400' : ''
                            } ${
                              showResults && quizAnswers[qIdx] === oIdx && oIdx !== q.correctAnswer ? 'bg-red-600 border-red-400' : ''
                            }`}
                          >
                            {opt}
                            {showResults && oIdx === q.correctAnswer && <CheckCircle2 className="w-4 h-4" />}
                            {showResults && quizAnswers[qIdx] === oIdx && oIdx !== q.correctAnswer && <XCircle className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {!showResults ? (
                    <button
                      onClick={() => setShowResults(true)}
                      className="w-full bg-white text-indigo-900 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
                    >
                      Check Answers
                    </button>
                  ) : (
                    <div className="text-center pt-4 border-t border-indigo-800">
                      <p className="text-indigo-200 text-sm mb-2">Your Score</p>
                      <p className="text-3xl font-black">
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
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Learning Hub</h1>
        <p className="text-gray-500 text-lg">Start a new learning journey or continue where you left off</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between max-w-md mx-auto">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between max-w-md mx-auto">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-500 hover:text-green-700">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Create New Learning Box */}
        <div className="aspect-square bg-white rounded-3xl border-2 border-dashed border-indigo-200 p-8 flex flex-col items-center justify-center text-center group hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1"
             onClick={() => document.getElementById('new-learning-modal')?.classList.remove('hidden')}>
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Plus className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Create a Learning</h3>
          <p className="text-sm text-gray-500 mt-2">Start learning anything with AI chatbot</p>
        </div>

        {/* History Sessions */}
        {sessions.map(session => (
          <div 
            key={session._id}
            onClick={() => setCurrentSession(session)}
            className="aspect-square bg-white rounded-3xl border border-gray-100 p-8 flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSession(session);
                    setShowDeleteConfirm(true);
                  }}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-xl font-bold text-gray-900 line-clamp-2">{session.topic}</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <History className="w-3 h-3" />
                <span>Last active {new Date(session.lastUpdatedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-indigo-600 font-bold uppercase tracking-wider">
                Continue Learning <ArrowLeft className="w-3 h-3 rotate-180" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Learning Modal */}
      <div id="new-learning-modal" className="fixed inset-0 bg-black/50 hidden flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">New Learning</h2>
            <button 
              onClick={() => {
                document.getElementById('new-learning-modal')?.classList.add('hidden');
                setTopic('');
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={startNewSession} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">What do you want to learn?</label>
              <input
                type="text"
                required
                autoFocus
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Quantum Physics, History of Rome..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !topic}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Start Learning
            </button>
          </form>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Delete Session</h2>
            <p className="text-gray-500 text-center mb-8">
              Are you sure you want to delete <span className="font-bold text-gray-900">{selectedSession?.topic}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedSession(null);
                  setError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteSession}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
