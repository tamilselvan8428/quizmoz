import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Clock, AlertTriangle, CheckCircle2, Maximize, Award, XCircle, AlertCircle } from 'lucide-react';

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
  const containerRef = useRef(null);

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
    <div ref={containerRef} className="min-h-screen bg-gray-50">
      {!isFullScreen && !isFinished ? (
        <div className="max-w-2xl mx-auto pt-20 text-center space-y-6 p-8 bg-white rounded-2xl shadow-xl border border-gray-100">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
            </div>
          )}
          <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex items-center gap-3 text-yellow-700">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <p className="text-sm font-medium">This quiz must be taken in full-screen mode. Exiting full-screen will pause the timer.</p>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{quiz.title}</h1>
          <div className="flex justify-center gap-8 text-gray-500">
            <div className="text-center">
              <p className="text-xs uppercase font-bold">Questions</p>
              <p className="text-xl font-bold text-gray-900">{quiz.questions.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase font-bold">Duration</p>
              <p className="text-xl font-bold text-gray-900">{quiz.duration}m</p>
            </div>
          </div>
          <button
            onClick={enterFullScreen}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <Maximize className="w-5 h-5" /> Enter Full Screen & Start
          </button>
        </div>
      ) : isFinished ? (
        <div className="max-w-4xl mx-auto pt-10 pb-20 px-4 space-y-8 animate-in fade-in duration-500">
          {/* Score Dashboard Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center space-y-6 relative overflow-hidden">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -z-10" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-50/50 rounded-tr-full -z-10" />

            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600">
              <Award className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-gray-900">Quiz Completed!</h1>
              <p className="text-gray-500 max-w-md mx-auto text-base">
                Great effort! Here is your performance summary for <span className="font-semibold text-gray-800">{quiz.title}</span>.
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
                    className="text-gray-100"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="text-indigo-600 transition-all duration-1000 ease-out"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 60}
                    strokeDashoffset={2 * Math.PI * 60 * (1 - (quiz.questions.filter((q, idx) => answers[idx] === q.correctAnswer).length / quiz.questions.length))}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-black text-gray-900">
                    {Math.round((quiz.questions.filter((q, idx) => answers[idx] === q.correctAnswer).length / quiz.questions.length) * 100)}%
                  </span>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</p>
                </div>
              </div>

              {/* Stats Breakdown */}
              <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-center min-w-[120px]">
                  <p className="text-2xl font-bold text-emerald-600">
                    {quiz.questions.filter((q, idx) => answers[idx] === q.correctAnswer).length}
                  </p>
                  <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Correct</p>
                </div>
                <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 text-center min-w-[120px]">
                  <p className="text-2xl font-bold text-red-600">
                    {quiz.questions.filter((q, idx) => answers[idx] !== -1 && answers[idx] !== q.correctAnswer).length}
                  </p>
                  <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">Incorrect</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center min-w-[120px]">
                  <p className="text-2xl font-bold text-gray-600">
                    {quiz.questions.filter((q, idx) => answers[idx] === -1).length}
                  </p>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Skipped</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center min-w-[120px]">
                  <p className="text-2xl font-bold text-indigo-600">
                    {quiz.questions.length}
                  </p>
                  <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">Total Qs</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
              {new Date() > new Date(quiz.endTime) ? (
                <button
                  onClick={() => setShowReview(!showReview)}
                  className="px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                >
                  {showReview ? 'Hide Answers' : 'Review Correct Answers'}
                </button>
              ) : (
                <div className="bg-yellow-50 text-yellow-800 text-sm border border-yellow-200 px-4 py-3 rounded-xl max-w-md">
                  Correct answers will be viewable after the quiz window ends on <span className="font-bold">{new Date(quiz.endTime).toLocaleString()}</span>.
                </div>
              )}
              <button
                onClick={() => navigate('/')}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-indigo-200"
              >
                Back to Dashboard
              </button>
            </div>
          </div>

          {/* Review List */}
          {showReview && new Date() > new Date(quiz.endTime) && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
              <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
                <span>Detailed Review</span>
                <span className="text-sm font-semibold bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                  {quiz.questions.length} Questions
                </span>
              </h2>

              {quiz.questions.map((q, qIdx) => {
                const selectedAns = answers[qIdx];
                const correctAns = q.correctAnswer;
                const isCorrect = selectedAns === correctAns;

                return (
                  <div key={qIdx} className={`bg-white rounded-2xl shadow-md border p-6 md:p-8 space-y-4 ${
                    isCorrect ? 'border-l-4 border-l-emerald-500' : selectedAns === -1 ? 'border-l-4 border-l-gray-400' : 'border-l-4 border-l-red-500'
                  }`}>
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 leading-relaxed">
                        Q{qIdx + 1}. {q.text}
                      </h3>
                      <div className="shrink-0 mt-1">
                        {isCorrect ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                          </span>
                        ) : selectedAns === -1 ? (
                          <span className="bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Skipped
                          </span>
                        ) : (
                          <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Incorrect
                          </span>
                        )}
                      </div>
                    </div>

                    {q.image && (
                      <img src={q.image} alt={`Question ${qIdx + 1}`} className="max-h-48 rounded-xl object-contain my-4" />
                    )}

                    <div className="grid grid-cols-1 gap-3 mt-4">
                      {q.options.map((opt, optIdx) => {
                        const isOptCorrect = optIdx === correctAns;
                        const isOptSelected = optIdx === selectedAns;

                        let optClass = "border-gray-100 bg-gray-50/50 text-gray-700";
                        let icon = null;

                        if (isOptCorrect) {
                          optClass = "border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold";
                          icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
                        } else if (isOptSelected && !isCorrect) {
                          optClass = "border-red-500 bg-red-50 text-red-900 font-semibold";
                          icon = <XCircle className="w-5 h-5 text-red-600 shrink-0" />;
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${optClass}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-gray-400 w-5">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <span>{opt}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isOptSelected && !isCorrect && (
                                <span className="text-xs font-bold text-red-500 uppercase tracking-wide mr-2 bg-red-100/50 px-2 py-0.5 rounded">
                                  Your Choice
                                </span>
                              )}
                              {isOptSelected && isCorrect && (
                                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide mr-2 bg-emerald-100/50 px-2 py-0.5 rounded">
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
      ) : (
        <div className="fixed inset-0 bg-gray-50 flex flex-col p-4 md:p-8 overflow-y-auto">
          <div className="max-w-4xl w-full mx-auto flex flex-col h-full">
            <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-xl shadow-sm border">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{quiz.title}</h2>
                <p className="text-sm text-gray-500">Question {currentQuestionIdx + 1} of {quiz.questions.length}</p>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-lg ${timeLeft < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-indigo-100 text-indigo-600'}`}>
                <Clock className="w-5 h-5" /> {formatTime(timeLeft)}
              </div>
            </div>

            <div className="flex-1 bg-white rounded-2xl shadow-sm border p-6 md:p-10 space-y-8">
              {currentQuestion.image && (
                <img src={currentQuestion.image} alt="Question" className="max-h-64 mx-auto rounded-xl object-contain mb-6" />
              )}
              <h3 className="text-2xl font-medium text-gray-900 leading-relaxed">
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
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                        : 'border-gray-100 hover:border-gray-200 text-gray-700'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      answers[currentQuestionIdx] === idx ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                    }`}>
                      {answers[currentQuestionIdx] === idx && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="text-lg">{opt}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex justify-between items-center pb-8">
              <button
                disabled={currentQuestionIdx === 0}
                onClick={() => setCurrentQuestionIdx(i => i - 1)}
                className="px-6 py-2 rounded-lg font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              
              <div className="flex gap-2">
                {quiz.questions.map((_, idx) => (
                  <div key={idx} className={`w-2 h-2 rounded-full ${
                    idx === currentQuestionIdx ? 'bg-indigo-600' :
                    answers[idx] !== -1 ? 'bg-indigo-200' : 'bg-gray-200'
                  }`} />
                ))}
              </div>

              {currentQuestionIdx === quiz.questions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg"
                >
                  Submit Quiz
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIdx(i => i + 1)}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg"
                >
                  Next Question
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showWarning && !isFinished && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-12 h-12 text-red-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Warning!</h2>
              <p className="text-gray-600">
                Tab switching is not allowed during the quiz. This is your <span className="font-bold text-red-600 underline">FIRST and ONLY warning</span>.
              </p>
              <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                If you switch tabs again, your quiz will be <span className="font-bold">automatically submitted</span> with your current progress.
              </p>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
            >
              I Understand, Continue Quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
