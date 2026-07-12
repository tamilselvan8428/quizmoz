import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Clock, AlertTriangle, CheckCircle2, Maximize, Award, XCircle, AlertCircle, Sparkles, Loader2, X } from 'lucide-react';
import { aiService } from '../../lib/gemini.js';
import Markdown from 'react-markdown';

export default function QuizPlayer({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [violations, setViolations] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analysisSaved, setAnalysisSaved] = useState(false);
  const containerRef = useRef(null);

  const handleAiAnalysis = async () => {
    if (!quiz || !answers || aiLoading) return;
    setAiLoading(true);
    setAiAnalysis('Thinking...');
    setAnalysisSaved(false);
    try {
      const report = await aiService.analyzeQuizResults(
        quiz.title,
        quiz.questions,
        answers,
        (chunk) => {
          setAiAnalysis(chunk);
        }
      );

      // Save to Learning Hub
      const newSession = {
        studentId: user.id,
        topic: `Quiz Analysis: ${quiz.title}`,
        messages: [
          { role: 'user', text: `Analyze my quiz results for "${quiz.title}"` },
          { role: 'model', text: report }
        ],
      };
      await api.learning.save(newSession);
      setAnalysisSaved(true);
    } catch (err) {
      console.error(err);
      setError('AI Analysis failed: ' + err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setAiLoading(false);
    }
  };

  const fetchQuiz = async () => {
    try {
      const quizzes = await api.quizzes.getAll();
      const q = quizzes.find(item => item._id === id);
      if (!q) {
        navigate('/');
        return;
      }
      setQuiz(q);
      setAnswers(new Array(q.questions.length).fill(-1));
      setTimeLeft(q.duration * 60);
    } catch (err) {
      console.error(err);
      navigate('/');
    }
  };

  useEffect(() => {
    fetchQuiz();

    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isFullScreen && !isFinished) {
        setViolations(v => v + 1);
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [id, navigate, isFullScreen, isFinished]);

  useEffect(() => {
    if (violations === 1) {
      setShowWarning(true);
    } else if (violations >= 2 && !isFinished) {
      handleSubmit();
    }
  }, [violations, isFinished]);

  useEffect(() => {
    if (timeLeft > 0 && !isFinished && isFullScreen) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !isFinished) {
      handleSubmit();
    }
  }, [timeLeft, isFinished, isFullScreen]);

  const enterFullScreen = () => {
    if (containerRef.current) {
      containerRef.current.requestFullscreen().catch(err => {
        setError(`Error attempting to enable full-screen mode: ${err.message}`);
        setTimeout(() => setError(''), 3000);
      });
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    
    let score = 0;
    quiz.questions.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswer) score++;
    });

    const result = {
      quizId: quiz._id,
      studentId: user.id,
      studentName: user.name,
      rollNo: user.rollNo,
      department: user.department,
      section: user.section,
      score,
      totalQuestions: quiz.questions.length,
      answers,
      submittedAt: new Date().toISOString(),
    };

    try {
      await api.results.save(result);
      setIsFinished(true);
      if (document.fullscreenElement) document.exitFullscreen();
    } catch (err) {
      setError('Failed to submit quiz: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  if (!quiz) return null;

  const currentQuestion = quiz.questions[currentQuestionIdx];
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12">
      {!isFullScreen && !isFinished ? (
        <div className="max-w-2xl w-full mx-auto text-center space-y-6 p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative animate-scale-in">
          {error && (
            <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-450 hover:text-red-300">×</button>
            </div>
          )}
          <div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20 flex items-center gap-3 text-yellow-400">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <p className="text-sm font-semibold">This quiz must be taken in full-screen mode. Exiting full-screen will submit the quiz.</p>
          </div>
          <h1 className="text-3xl font-black text-white">{quiz.title}</h1>
          <div className="flex justify-center gap-12 text-slate-400 border-y border-slate-850 py-4">
            <div className="text-center">
              <p className="text-xs uppercase font-bold tracking-wider">Questions</p>
              <p className="text-2xl font-black text-white">{quiz.questions.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase font-bold tracking-wider">Duration</p>
              <p className="text-2xl font-black text-white">{quiz.duration}m</p>
            </div>
          </div>
          <button
            onClick={enterFullScreen}
            className="w-full bg-[#2059a1] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#1a4b87] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2059a1]/10"
          >
            <Maximize className="w-5 h-5" /> Enter Full Screen & Start
          </button>
        </div>      ) : isFinished ? (
        <div className="max-w-4xl mx-auto pt-10 pb-20 px-4 space-y-8 animate-in fade-in duration-500">
          {/* Score Dashboard Card */}
          <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800/80 p-8 text-center space-y-6 relative overflow-hidden">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#2059a1]/10 rounded-bl-full -z-10 animate-pulse" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-500/5 rounded-tr-full -z-10 animate-pulse" />
 
            <div className="w-20 h-20 bg-yellow-500/10 border border-yellow-500/20 rounded-full flex items-center justify-center mx-auto text-yellow-500 animate-bounce">
              <Award className="w-10 h-10" />
            </div>
 
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-white">Quiz Completed!</h1>
              <p className="text-slate-400 max-w-md mx-auto text-sm font-medium">
                Great effort! Here is your performance summary for <span className="font-bold text-slate-200">{quiz.title}</span>.
              </p>
            </div>
 
            {/* Score circle / stats */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
              {/* Circular score display */}
              <div className="relative flex items-center justify-center">
                <svg className="w-36 h-36 transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="text-slate-800"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="text-[#ecbf21] transition-all duration-1000 ease-out"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 60}
                    strokeDashoffset={2 * Math.PI * 60 * (1 - (quiz.questions.filter((q, idx) => answers[idx] === q.correctAnswer).length / quiz.questions.length))}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-black text-white">
                    {Math.round((quiz.questions.filter((q, idx) => answers[idx] === q.correctAnswer).length / quiz.questions.length) * 100)}%
                  </span>
                  <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Score</p>
                </div>
              </div>
 
              {/* Stats Breakdown */}
              <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                <div className="bg-emerald-950/40 border border-emerald-900/50 rounded-2xl p-4 text-center min-w-[120px]">
                  <p className="text-2xl font-black text-green-400">
                    {quiz.questions.filter((q, idx) => answers[idx] === q.correctAnswer).length}
                  </p>
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-wide">Correct</p>
                </div>
                <div className="bg-red-950/40 border border-red-900/50 rounded-2xl p-4 text-center min-w-[120px]">
                  <p className="text-2xl font-black text-red-400">
                    {quiz.questions.filter((q, idx) => answers[idx] !== -1 && answers[idx] !== q.correctAnswer).length}
                  </p>
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Incorrect</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-center min-w-[120px]">
                  <p className="text-2xl font-black text-slate-300">
                    {quiz.questions.filter((q, idx) => answers[idx] === -1).length}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Skipped</p>
                </div>
                <div className="bg-[#2059a1]/10 border border-[#2059a1]/25 rounded-2xl p-4 text-center min-w-[120px]">
                  <p className="text-2xl font-black text-blue-300">
                    {quiz.questions.length}
                  </p>
                  <p className="text-[10px] font-bold text-blue-450 uppercase tracking-wide">Total Qs</p>
                </div>
              </div>
            </div>
 
            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
              <button
                onClick={handleAiAnalysis}
                disabled={aiLoading}
                className="px-6 py-3 bg-[#2059a1] text-white rounded-xl font-bold hover:bg-[#1a4b87] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2059a1]/10 disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 animate-pulse" />
                    Analyze with AI
                  </>
                )}
              </button>
              {new Date() > new Date(quiz.endTime) ? (
                <button
                  onClick={() => setShowReview(!showReview)}
                  className="px-6 py-3 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl font-bold hover:bg-slate-750 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  {showReview ? 'Hide Answers' : 'Review Correct Answers'}
                </button>
              ) : (
                <div className="bg-yellow-500/10 text-yellow-400 text-xs border border-yellow-500/25 px-4 py-3 rounded-xl max-w-sm">
                  Correct answers will be viewable after the quiz ends on <span className="font-bold">{new Date(quiz.endTime).toLocaleString()}</span>.
                </div>
              )}
              <button
                onClick={() => navigate('/')}
                className="px-8 py-3 bg-slate-850 hover:bg-slate-800 text-white rounded-xl font-bold border border-slate-750 transition-all shadow-md"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
 
          {/* AI Analysis Card */}
          {aiAnalysis && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl animate-fade-in-up">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/25 rounded-xl text-yellow-500">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">AI Performance Analysis & Study Guide</h2>
                    <p className="text-xs text-slate-450 mt-1">Based on your answers. This guide has been automatically saved to your Learning Hub.</p>
                  </div>
                </div>
                <button
                  onClick={() => setAiAnalysis('')}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-450 hover:text-white transition-colors"
                  title="Close Analysis"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="prose prose-sm max-w-none text-slate-200 leading-relaxed max-h-[500px] overflow-y-auto pr-2">
                <Markdown>{aiAnalysis}</Markdown>
              </div>
              
              {analysisSaved && (
                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-4 py-2.5 rounded-xl text-sm font-semibold max-w-fit animate-scale-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-bounce" /> Saved to Learning Hub!
                </div>
              )}
            </div>
          )}

          {/* Review List */}
          {showReview && new Date() > new Date(quiz.endTime) && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-500 text-white">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <span>Detailed Review</span>
                <span className="text-xs font-semibold bg-slate-850 text-slate-400 px-3 py-1 rounded-full border border-slate-800">
                  {quiz.questions.length} Questions
                </span>
              </h2>

              {quiz.questions.map((q, qIdx) => {
                const selectedAns = answers[qIdx];
                const correctAns = q.correctAnswer;
                const isCorrect = selectedAns === correctAns;

                return (
                  <div key={qIdx} className={`bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 md:p-8 space-y-4 ${
                    isCorrect ? 'border-l-4 border-l-emerald-500' : selectedAns === -1 ? 'border-l-4 border-l-slate-700' : 'border-l-4 border-l-red-500'
                  }`}>
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="text-lg md:text-xl font-bold text-white leading-relaxed">
                        Q{qIdx + 1}. {q.text}
                      </h3>
                      <div className="shrink-0 mt-1">
                        {isCorrect ? (
                          <span className="bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                          </span>
                        ) : selectedAns === -1 ? (
                          <span className="bg-slate-850 text-slate-400 border border-slate-750 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Skipped
                          </span>
                        ) : (
                          <span className="bg-red-950/50 text-red-400 border border-red-900/40 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Incorrect
                          </span>
                        )}
                      </div>
                    </div>

                    {q.image && (
                      <img src={q.image} alt={`Question ${qIdx + 1}`} className="max-h-48 rounded-xl object-contain my-4 border border-slate-850 bg-slate-950 p-2" />
                    )}

                    <div className="grid grid-cols-1 gap-3 mt-4">
                      {q.options.map((opt, optIdx) => {
                        const isOptCorrect = optIdx === correctAns;
                        const isOptSelected = optIdx === selectedAns;

                        let optClass = "border-slate-800 bg-slate-950 text-slate-350";
                        let icon = null;

                        if (isOptCorrect) {
                          optClass = "border-emerald-900/50 bg-emerald-950/30 text-emerald-300 font-semibold";
                          icon = <CheckCircle2 className="w-5 h-5 text-emerald-450 shrink-0" />;
                        } else if (isOptSelected && !isCorrect) {
                          optClass = "border-red-900/50 bg-red-950/30 text-red-300 font-semibold";
                          icon = <XCircle className="w-5 h-5 text-red-455 shrink-0" />;
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${optClass}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-slate-500 w-5">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <span>{opt}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isOptSelected && !isCorrect && (
                                <span className="text-xs font-bold text-red-400 uppercase tracking-wide mr-2 bg-red-950/50 border border-red-900/30 px-2 py-0.5 rounded">
                                  Your Choice
                                </span>
                              )}
                              {isOptSelected && isCorrect && (
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide mr-2 bg-emerald-950/50 border border-emerald-900/30 px-2 py-0.5 rounded">
                                  Your Choice
                                </span>
                              )}
                              {icon}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (        <div className="fixed inset-0 bg-slate-950 flex flex-col p-4 md:p-8 overflow-y-auto">
          <div className="max-w-4xl w-full mx-auto flex flex-col h-full justify-between">
            <div className="flex items-center justify-between mb-8 bg-slate-900 p-4 rounded-2xl shadow-xl border border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">{quiz.title}</h2>
                <p className="text-xs text-slate-450 mt-1">Question {currentQuestionIdx + 1} of {quiz.questions.length}</p>
              </div>
              {error && (
                <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-4 py-2 rounded-xl text-sm">
                  {error}
                </div>
              )}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-base ${timeLeft < 60 ? 'bg-red-950/50 border border-red-900/50 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-200 border border-slate-700/60'}`}>
                <Clock className="w-4 h-4 text-slate-400" /> {formatTime(timeLeft)}
              </div>
            </div>

            <div className="flex-1 bg-slate-900 rounded-3xl shadow-xl border border-slate-800 p-6 md:p-10 space-y-8">
              {currentQuestion.image && (
                <img src={currentQuestion.image} alt="Question" className="max-h-64 mx-auto rounded-xl object-contain mb-6 border border-slate-850 bg-slate-950 p-2" />
              )}
              <h3 className="text-xl md:text-2xl font-bold text-white leading-relaxed">
                {currentQuestion.text}
              </h3>

              <div className="grid grid-cols-1 gap-4">
                {currentQuestion.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const newAnswers = [...answers];
                      newAnswers[currentQuestionIdx] = idx;
                      setAnswers(newAnswers);
                    }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                      answers[currentQuestionIdx] === idx
                        ? 'border-[#2059a1] bg-[#2059a1]/10 text-white'
                        : 'border-slate-800 hover:border-slate-700 text-slate-350 bg-slate-950/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      answers[currentQuestionIdx] === idx ? 'border-[#2059a1] bg-[#2059a1]' : 'border-slate-600 bg-slate-950'
                    }`}>
                      {answers[currentQuestionIdx] === idx && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <span className="text-base font-semibold">{opt}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex justify-between items-center pb-8 shrink-0">
              <button
                disabled={currentQuestionIdx === 0}
                onClick={() => setCurrentQuestionIdx(i => i - 1)}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:bg-slate-900 disabled:opacity-30 transition-colors border border-transparent hover:border-slate-800"
              >
                Previous
              </button>
              
              <div className="flex gap-2">
                {quiz.questions.map((_, idx) => (
                  <div key={idx} className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    idx === currentQuestionIdx ? 'bg-[#ecbf21]' :
                    answers[idx] !== -1 ? 'bg-indigo-700/60' : 'bg-slate-800'
                  }`} />
                ))}
              </div>

              {currentQuestionIdx === quiz.questions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/10"
                >
                  Submit Quiz
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIdx(i => i + 1)}
                  className="px-8 py-3 bg-[#2059a1] text-white rounded-xl font-bold hover:bg-[#1a4b87] transition-all shadow-lg shadow-[#2059a1]/10"
                >
                  Next Question
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showWarning && !isFinished && (
        <div className="fixed inset-0 bg-black/75 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl animate-scale-in">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/25 rounded-full flex items-center justify-center mx-auto text-red-500 animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">Warning!</h2>
              <p className="text-slate-350 text-sm">
                Tab switching is not allowed during the quiz. This is your <span className="font-extrabold text-red-400 underline">FIRST and ONLY warning</span>.
              </p>
              <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-850">
                If you switch tabs again, your quiz will be <span className="font-bold text-white">automatically submitted</span> with your current progress.
              </p>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full bg-[#2059a1] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#194680] transition-all shadow-lg shadow-[#2059a1]/10"
            >
              I Understand, Continue Quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
