import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { ClipboardList, Award, Clock, ChevronRight, CheckCircle2, XCircle, ChevronDown, ChevronUp, AlertCircle, Sparkles, Loader2, X, BookOpen, FileText, Download, Folder, FolderOpen, Eye } from 'lucide-react';
import { aiService } from '../../lib/gemini.js';
import Markdown from 'react-markdown';

export default function StudentDashboard() {
  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [studyMaterials, setStudyMaterials] = useState([]);
  const [activeTab, setActiveTab] = useState('available');
  const [user, setUser] = useState(null);
  const [expandedResults, setExpandedResults] = useState({});
  const [aiLoading, setAiLoading] = useState({});
  const [aiAnalysis, setAiAnalysis] = useState({});
  const [analysisSaved, setAnalysisSaved] = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});
  const [selfTestQuiz, setSelfTestQuiz] = useState(null);
  const [selfTestAnswers, setSelfTestAnswers] = useState({});
  const [showSelfTest, setShowSelfTest] = useState(false);
  const [selfTestLoading, setSelfTestLoading] = useState(false);
  const [selfTestFinished, setSelfTestFinished] = useState(false);
  const [selfTestTopic, setSelfTestTopic] = useState('');
  const [currentSelfTestQ, setCurrentSelfTestQ] = useState(0);

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

  const toggleFolderExpansion = (folderId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const groupMaterialsByFolder = (materialsList) => {
    const grouped = [];
    const folderMap = {};

    materialsList.forEach(material => {
      if (material.folderId) {
        if (!folderMap[material.folderId]) {
          folderMap[material.folderId] = {
            isFolder: true,
            _id: material.folderId,
            folderId: material.folderId,
            title: material.folderName || 'Untitled Folder',
            topic: material.topic,
            description: material.description,
            createdAt: material.createdAt,
            uploadedBy: material.uploadedBy,
            uploaderName: material.uploaderName,
            files: []
          };
          grouped.push(folderMap[material.folderId]);
        }
        folderMap[material.folderId].files.push(material);
        
        if (new Date(material.createdAt) > new Date(folderMap[material.folderId].createdAt)) {
          folderMap[material.folderId].createdAt = material.createdAt;
        }
      } else {
        grouped.push(material);
      }
    });

    return grouped.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const handleViewOnline = (material) => {
    if (!material.fileContent) return;
    try {
      const newTab = window.open();
      if (newTab) {
        newTab.document.write(
          `<iframe src="${material.fileContent}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%; position:fixed;" allowfullscreen></iframe>`
        );
        newTab.document.title = material.title || material.fileName;
        newTab.document.close();
      }
    } catch (err) {
      console.error("Failed to open online viewer:", err);
      alert("Could not view file online. Try downloading it instead.");
    }
  };

  const handleStartSelfTest = async (item) => {
    const materials = item.isFolder ? item.files : [item];
    if (materials.length === 0) return;

    setSelfTestTopic(item.title);
    setShowSelfTest(true);
    setSelfTestLoading(true);
    setSelfTestFinished(false);
    setSelfTestAnswers({});
    setSelfTestQuiz(null);
    setCurrentSelfTestQ(0);

    try {
      const questions = await aiService.generateQuizFromMaterials(materials, 5);
      if (!questions || questions.length === 0) {
        throw new Error("No questions were generated by the AI.");
      }
      setSelfTestQuiz(questions);
    } catch (err) {
      console.error(err);
      alert("Failed to generate AI quiz: " + err.message);
      setShowSelfTest(false);
    } finally {
      setSelfTestLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      setUser(currentUser);
      const [allQuizzes, allResults, allMaterials] = await Promise.all([
        api.quizzes.getAll(),
        api.results.getAll(),
        api.studyMaterials.getAll()
      ]);
      setQuizzes(allQuizzes);
      setResults(allResults.filter(r => r.studentId === currentUser.id));
      setStudyMaterials(allMaterials);
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
        <button
          onClick={() => setActiveTab('materials')}
          className={`pb-4 px-4 font-medium transition-colors relative ${
            activeTab === 'materials' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Study Materials
          {activeTab === 'materials' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-scale-in" />}
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

      {activeTab === 'materials' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up" key="materials">
          {studyMaterials.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-200">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-500 font-medium">No study materials available at the moment.</p>
            </div>
          ) : (
            groupMaterialsByFolder(studyMaterials).map(item => {
              if (item.isFolder) {
                const isExpanded = expandedFolders[item.folderId];
                return (
                  <div key={item.folderId} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col hover:shadow-md hover:border-indigo-150 transition-all duration-300 relative col-span-full">
                    <div className="flex justify-between items-start mb-4 pr-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-yellow-50 rounded-xl text-yellow-600">
                          {isExpanded ? <FolderOpen className="w-8 h-8 fill-yellow-200" /> : <Folder className="w-8 h-8 fill-yellow-100" />}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            {item.title}
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                              {item.files.length} Files
                            </span>
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Created on {new Date(item.createdAt).toLocaleDateString()} • {item.topic || 'General'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 absolute top-6 right-6">
                        <button
                          onClick={() => toggleFolderExpansion(item.folderId)}
                          className="text-sm font-bold text-indigo-600 hover:text-indigo-850 transition-colors flex items-center gap-1 focus:outline-none bg-slate-50 border border-slate-200/50 px-2.5 py-1 rounded-lg"
                        >
                          {isExpanded ? 'Hide Files' : 'Open Folder'}
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-gray-500 text-sm mb-4 bg-slate-50/50 p-2.5 border border-slate-100 rounded-lg">{item.description}</p>
                    )}

                    {isExpanded && (
                      <div className="mt-4 border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
                        {item.files.map(file => (
                          <div key={file._id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/40 relative flex flex-col justify-between">
                            <div className="mb-3">
                              <h4 className="font-semibold text-gray-900 text-sm truncate">{file.title}</h4>
                              <p className="text-slate-400 text-[10px] mt-0.5 truncate">{file.fileName}</p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleViewOnline(file)}
                                className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-1.5 rounded-lg text-xs font-semibold hover:border-indigo-200 transition-all flex items-center justify-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                              <button
                                onClick={() => {
                                  const linkSource = file.fileContent;
                                  const downloadLink = document.createElement("a");
                                  downloadLink.href = linkSource;
                                  downloadLink.download = file.fileName;
                                  downloadLink.click();
                                }}
                                className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all flex items-center justify-center gap-1"
                              >
                                <Download className="w-3.5 h-3.5" /> Get
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <button
                      onClick={() => handleStartSelfTest(item)}
                      className="mt-4 w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 fill-white/20 animate-pulse" /> Test Myself on Folder
                    </button>
                  </div>
                );
              }

              // Standalone document
              return (
                <div key={item._id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col hover:-translate-y-1 hover:shadow-md hover:border-indigo-100/50 transition-all duration-300">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{item.topic || 'General'}</span>
                    </div>
                    {item.fileSize && (
                      <span className="text-xs text-gray-440">
                        {Math.round(item.fileSize / 1024)} KB
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 flex-1">{item.description || 'No description provided.'}</p>
                  
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-455 mb-3">
                    <span>Uploaded by: <strong className="text-slate-655 font-semibold">{item.uploaderName}</strong></span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>

                  {item.fileContent && (
                    <div className="flex flex-col gap-2 mt-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewOnline(item)}
                          className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 px-3 rounded-xl font-semibold text-xs border border-indigo-100 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Online
                        </button>
                        
                        <button
                          onClick={() => {
                            const linkSource = item.fileContent;
                            const downloadLink = document.createElement("a");
                            downloadLink.href = linkSource;
                            downloadLink.download = item.fileName;
                            downloadLink.click();
                          }}
                          className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-2 px-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      </div>

                      <button
                        onClick={() => handleStartSelfTest(item)}
                        className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 fill-white/20 animate-pulse" /> Test Myself with AI
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      {showSelfTest && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-8 max-h-[90vh] flex flex-col animate-scale-in relative text-left overflow-hidden">
            
            {/* Close Modal Button */}
            <button
              onClick={() => setShowSelfTest(false)}
              className="absolute top-6 right-6 p-1.5 hover:bg-slate-150 rounded-lg text-slate-400 hover:text-slate-600 transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Header */}
            <div className="border-b border-slate-100 pb-4 shrink-0 pr-10">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500 fill-yellow-100" />
                AI Practice Self-Test
              </h2>
              <p className="text-xs text-slate-450 mt-1 truncate">Topic: {selfTestTopic}</p>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto my-6 pr-1 scrollbar-thin">
              {selfTestLoading && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                  <p className="text-slate-600 font-semibold text-sm">Gemini is parsing the documents and generating your questions...</p>
                  <p className="text-xs text-slate-400 max-w-xs">This takes about 5-10 seconds to create high-quality multiple choice questions.</p>
                </div>
              )}

              {!selfTestLoading && selfTestQuiz && !selfTestFinished && (
                <div className="space-y-6">
                  {/* Progress Indicators */}
                  <div className="flex items-center justify-between text-xs text-slate-450">
                    <span className="font-bold uppercase tracking-wider text-indigo-600">Question {currentSelfTestQ + 1} of {selfTestQuiz.length}</span>
                    <span>{Math.round(((currentSelfTestQ) / selfTestQuiz.length) * 100)}% Complete</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${((currentSelfTestQ) / selfTestQuiz.length) * 100}%` }}
                    />
                  </div>

                  {/* Question Text */}
                  <h3 className="text-base font-bold text-gray-900 leading-snug">
                    {selfTestQuiz[currentSelfTestQ].text}
                  </h3>

                  {/* Choice Options */}
                  <div className="space-y-3">
                    {selfTestQuiz[currentSelfTestQ].options.map((option, idx) => {
                      const isSelected = selfTestAnswers[currentSelfTestQ] === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelfTestAnswers(prev => ({ ...prev, [currentSelfTestQ]: idx }))}
                          className={`w-full text-left p-4 rounded-xl border font-medium text-sm transition-all flex items-center justify-between group ${
                            isSelected 
                              ? 'border-indigo-650 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20' 
                              : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span>{option}</span>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-4 transition-colors ${
                            isSelected ? 'border-indigo-650 bg-indigo-600' : 'border-slate-300 bg-white group-hover:border-slate-400'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!selfTestLoading && selfTestQuiz && selfTestFinished && (
                <div className="space-y-6">
                  {/* Results Summary banner */}
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 text-center">
                    <p className="text-xs uppercase tracking-wider text-indigo-600 font-bold mb-1">Self-Test Score</p>
                    <p className="text-4xl font-black text-indigo-950">
                      {selfTestQuiz.reduce((acc, q, idx) => acc + (selfTestAnswers[idx] === q.correctAnswer ? 1 : 0), 0)} / {selfTestQuiz.length}
                    </p>
                    <p className="text-xs text-indigo-700 mt-2 font-medium">Great practice session! Review the answers below.</p>
                  </div>

                  {/* Review Questions list */}
                  <div className="space-y-5 mt-4">
                    {selfTestQuiz.map((q, idx) => {
                      const selected = selfTestAnswers[idx];
                      const correct = q.correctAnswer;
                      const isCorrect = selected === correct;
                      return (
                        <div key={idx} className="p-5 border border-slate-150 rounded-2xl space-y-3 bg-white">
                          <div className="flex items-start gap-2.5 justify-between">
                            <h4 className="font-bold text-gray-900 text-sm leading-snug">
                              Q{idx + 1}: {q.text}
                            </h4>
                            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                              isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {q.options.map((option, oIdx) => {
                              let optionClass = 'border-slate-100 bg-slate-50/50 text-slate-500';
                              if (oIdx === correct) {
                                optionClass = 'border-green-200 bg-green-50/30 text-green-800 font-semibold';
                              } else if (oIdx === selected) {
                                optionClass = 'border-red-200 bg-red-50/30 text-red-800 font-semibold';
                              }

                              return (
                                <div key={oIdx} className={`p-3 rounded-xl border text-xs flex items-center justify-between ${optionClass}`}>
                                  <span>{option}</span>
                                  {oIdx === correct && <span className="text-green-600 text-xs font-bold font-mono">✓ Correct Choice</span>}
                                  {oIdx === selected && oIdx !== correct && <span className="text-red-600 text-xs font-bold font-mono">Your Choice</span>}
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

            {/* Footer / Action controls */}
            <div className="border-t border-slate-100 pt-4 shrink-0 flex gap-4">
              {!selfTestLoading && selfTestQuiz && !selfTestFinished && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentSelfTestQ > 0) {
                        setCurrentSelfTestQ(prev => prev - 1);
                      } else {
                        setShowSelfTest(false);
                      }
                    }}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-655 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-center text-sm"
                  >
                    {currentSelfTestQ > 0 ? 'Previous' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={selfTestAnswers[currentSelfTestQ] === undefined}
                    onClick={() => {
                      if (currentSelfTestQ < selfTestQuiz.length - 1) {
                        setCurrentSelfTestQ(prev => prev + 1);
                      } else {
                        setSelfTestFinished(true);
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-indigo-600 disabled:opacity-50 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-center text-sm"
                  >
                    {currentSelfTestQ < selfTestQuiz.length - 1 ? 'Next Question' : 'Finish Test'}
                  </button>
                </>
              )}

              {!selfTestLoading && selfTestFinished && (
                <button
                  type="button"
                  onClick={() => setShowSelfTest(false)}
                  className="w-full px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-center text-sm"
                >
                  Close Practice Test
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
