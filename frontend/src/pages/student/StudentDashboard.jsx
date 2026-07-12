import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { ClipboardList, Award, Clock, ChevronRight, CheckCircle2, XCircle, ChevronDown, ChevronUp, AlertCircle, Sparkles, Loader2, X } from 'lucide-react';
import { aiService } from '../../lib/gemini.js';
import Markdown from 'react-markdown';

export default function StudentDashboard() {
  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [activeTab, setActiveTab] = useState('available');
  const [user, setUser] = useState(null);
  const [expandedResults, setExpandedResults] = useState({});
  const [aiLoading, setAiLoading] = useState({});
  const [aiAnalysis, setAiAnalysis] = useState({});
  const [analysisSaved, setAnalysisSaved] = useState({});

  const handleAiAnalysis = async (result, quiz) => {
    if (!result || !quiz || aiLoading[result._id]) return;
    
    setAiLoading(prev => ({ ...prev, [result._id]: true }));
    setAiAnalysis(prev => ({ ...prev, [result._id]: 'Thinking...' }));
    setAnalysisSaved(prev => ({ ...prev, [result._id]: false }));
    
    try {
      const report = await aiService.analyzeQuizResults(
        quiz.title,
        quiz.questions,
        result.answers,
        (chunk) => {
          setAiAnalysis(prev => ({ ...prev, [result._id]: chunk }));
        }
      );

      // Save to Learning Hub
      const newSession = {
        studentId: result.studentId,
        topic: `Quiz Analysis: ${quiz.title}`,
        messages: [
          { role: 'user', text: `Analyze my quiz results for "${quiz.title}"` },
          { role: 'model', text: report }
        ],
      };
      await api.learning.save(newSession);
      setAnalysisSaved(prev => ({ ...prev, [result._id]: true }));
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(prev => ({ ...prev, [result._id]: false }));
    }
  };

  const toggleResultExpansion = (resultId) => {
    setExpandedResults(prev => ({
      ...prev,
      [resultId]: !prev[resultId]
    }));
  };

  const fetchData = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      setUser(currentUser);
      const [allQuizzes, allResults] = await Promise.all([
        api.quizzes.getAll(),
        api.results.getAll()
      ]);
      setQuizzes(allQuizzes);
      setResults(allResults.filter(r => r.studentId === currentUser.id));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isQuizAvailable = (quiz) => {
    const now = new Date();
    const start = new Date(quiz.startTime);
    const end = new Date(quiz.endTime);
    const alreadyTaken = results.some(r => r.quizId === quiz._id);
    return now >= start && now <= end && !alreadyTaken;
  };

  const isQuizUpcoming = (quiz) => {
    const now = new Date();
    const start = new Date(quiz.startTime);
    const alreadyTaken = results.some(r => r.quizId === quiz._id);
    return now < start && !alreadyTaken;
  };

  return (
    <div className="space-y-8">
      <div className="bg-indigo-600 rounded-2xl p-8 text-white shadow-xl shadow-indigo-200/40 animate-fade-in-up">
        <h1 className="text-3xl font-bold mb-2">Hello, {user?.name}!</h1>
        <p className="text-indigo-100 opacity-90">Ready to test your knowledge today?</p>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('available')}
          className={`pb-4 px-4 font-medium transition-colors relative ${
            activeTab === 'available' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Available Quizzes
          {activeTab === 'available' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-scale-in" />}
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-4 px-4 font-medium transition-colors relative ${
            activeTab === 'upcoming' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Upcoming Quizzes
          {activeTab === 'upcoming' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-scale-in" />}
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`pb-4 px-4 font-medium transition-colors relative ${
            activeTab === 'results' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          My Results
          {activeTab === 'results' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-scale-in" />}
        </button>
      </div>

      {activeTab === 'available' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up" key="available">
          {quizzes.filter(isQuizAvailable).length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-200">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No quizzes available at the moment.</p>
            </div>
          ) : (
            quizzes.filter(isQuizAvailable).map(quiz => (
              <div key={quiz._id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col hover:-translate-y-1 hover:shadow-md hover:border-indigo-100/50 transition-all duration-300">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{quiz.title}</h3>
                <p className="text-gray-600 text-sm mb-4 flex-1">{quiz.description}</p>
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>Ends: {new Date(quiz.endTime).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <ClipboardList className="w-4 h-4" />
                    <span>{quiz.questions.length} Questions • {quiz.duration} mins</span>
                  </div>
                </div>
                <Link
                  to={`/student/quiz/${quiz._id}`}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold text-center hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-100"
                >
                  Start Quiz <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'upcoming' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up" key="upcoming">
          {quizzes.filter(isQuizUpcoming).length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-200">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No upcoming quizzes scheduled.</p>
            </div>
          ) : (
            quizzes.filter(isQuizUpcoming).map(quiz => (
              <div key={quiz._id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col opacity-75 hover:-translate-y-1 hover:shadow-md hover:border-slate-200 transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{quiz.title}</h3>
                  <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full font-medium">Upcoming</span>
                </div>
                <p className="text-gray-600 text-sm mb-4 flex-1">{quiz.description}</p>
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>Starts: {new Date(quiz.startTime).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <ClipboardList className="w-4 h-4" />
                    <span>{quiz.questions.length} Questions • {quiz.duration} mins</span>
                  </div>
                </div>
                <button
                  disabled
                  className="w-full bg-gray-100 text-gray-400 py-2 rounded-lg font-semibold text-center cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Not Yet Started
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'results' && (
        <div className="space-y-4 animate-fade-in-up" key="results">
          {results.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-200">
              <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">You haven't completed any quizzes yet.</p>
            </div>
          ) : (
            results.map(result => {
              const quiz = quizzes.find(q => q._id === result.quizId);
              const percentage = (result.score / result.totalQuestions) * 100;
              
              return (
                <div key={result._id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100/30 transition-all duration-300">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{quiz?.title || 'Deleted Quiz'}</h3>
                      <p className="text-sm text-gray-500">Submitted on {new Date(result.submittedAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-xs text-gray-400 uppercase font-bold">Score</p>
                        <p className={`text-2xl font-black ${percentage >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                          {result.score}/{result.totalQuestions}
                        </p>
                      </div>
                      <div className="h-12 w-px bg-gray-100" />
                      <div className="text-center">
                        <p className="text-xs text-gray-400 uppercase font-bold">Status</p>
                        <div className="flex items-center gap-1 text-green-600 font-bold">
                          <CheckCircle2 className="w-4 h-4" /> Completed
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Show answers after quiz ends */}
                  {quiz && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col items-start gap-4 w-full">
                      <div className="flex flex-wrap items-center gap-3">
                        {new Date() > new Date(quiz.endTime) ? (
                          <button
                            onClick={() => toggleResultExpansion(result._id)}
                            className="text-sm font-bold text-indigo-600 hover:text-indigo-855 px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl transition-all flex items-center gap-1.5 focus:outline-none animate-fade-in"
                          >
                            <span>{expandedResults[result._id] ? 'Hide Review' : 'Review Correct Answers'}</span>
                            {expandedResults[result._id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        ) : (
                          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Answers viewable after quiz window ends on {new Date(quiz.endTime).toLocaleString()}.
                          </p>
                        )}
                        
                        <button
                          onClick={() => handleAiAnalysis(result, quiz)}
                          disabled={aiLoading[result._id]}
                          className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 focus:outline-none px-4 py-1.5 rounded-xl shadow-md shadow-indigo-150 disabled:opacity-50"
                        >
                          {aiLoading[result._id] ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Analyzing...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Analyze with AI</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* AI Analysis Report display box */}
                      {aiAnalysis[result._id] && (
                        <div className="w-full bg-slate-50/50 rounded-2xl border border-slate-200/80 p-6 space-y-4 animate-fade-in-up mt-2">
                          <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                            <div className="flex items-center gap-2.5">
                              <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                              <h4 className="font-extrabold text-gray-900 text-base">AI Performance Analysis & Study Guide</h4>
                            </div>
                            <button
                              onClick={() => {
                                setAiAnalysis(prev => {
                                  const updated = { ...prev };
                                  delete updated[result._id];
                                  return updated;
                                });
                              }}
                              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
                              title="Close Analysis"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed max-h-[350px] overflow-y-auto pr-1">
                            <Markdown>{aiAnalysis[result._id]}</Markdown>
                          </div>
                          {analysisSaved[result._id] && (
                            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg max-w-fit animate-scale-in">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-bounce" /> Saved to Learning Hub!
                            </div>
                          )}
                        </div>
                      )}

                      {expandedResults[result._id] && new Date() > new Date(quiz.endTime) && (
                        <div className="mt-2 w-full space-y-6 animate-fade-in-up">
                          <h4 className="font-extrabold text-gray-900 text-base">Detailed Question Review</h4>
                          <div className="space-y-4">
                            {quiz.questions.map((q, idx) => {
                              const selectedAns = result.answers[idx];
                              const correctAns = q.correctAnswer;
                              const isCorrect = selectedAns === correctAns;

                              return (
                                <div key={idx} className={`p-5 rounded-2xl bg-white border shadow-sm space-y-3 ${
                                  isCorrect ? 'border-l-4 border-l-emerald-500' : selectedAns === -1 ? 'border-l-4 border-l-gray-400' : 'border-l-4 border-l-red-500'
                                }`}>
                                  <div className="flex justify-between items-start gap-4">
                                    <p className="font-semibold text-gray-900 text-base leading-relaxed">
                                      {idx + 1}. {q.text}
                                    </p>
                                    <div className="shrink-0">
                                      {isCorrect ? (
                                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3" /> Correct
                                        </span>
                                      ) : selectedAns === -1 ? (
                                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3" /> Skipped
                                        </span>
                                      ) : (
                                        <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                                          <XCircle className="w-3 h-3" /> Incorrect
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 gap-2 mt-2">
                                    {q.options.map((opt, oIdx) => {
                                      const isOptCorrect = oIdx === correctAns;
                                      const isOptSelected = oIdx === selectedAns;

                                      let optStyle = "border-gray-100 bg-gray-50/50 text-gray-700";
                                      let choiceBadge = null;

                                      if (isOptCorrect) {
                                        optStyle = "border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold";
                                      } else if (isOptSelected && !isCorrect) {
                                        optStyle = "border-red-500 bg-red-50 text-red-900 font-semibold";
                                      }

                                      if (isOptSelected) {
                                        choiceBadge = (
                                          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                            isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                          }`}>
                                            Your Choice
                                          </span>
                                        );
                                      }

                                      return (
                                        <div key={oIdx} className={`p-3 rounded-xl border text-sm flex items-center justify-between gap-4 transition-all ${optStyle}`}>
                                          <div className="flex items-center gap-2">
                                            <span className="text-gray-400 font-medium">{String.fromCharCode(65 + oIdx)}.</span>
                                            <span>{opt}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {choiceBadge}
                                            {isOptCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                                            {isOptSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-600" />}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
