import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Plus, Edit, Trash2, ClipboardList, Clock, Download, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function StaffDashboard() {
  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('quizzes');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showScoreUpdate, setShowScoreUpdate] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [newScore, setNewScore] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedResults, setExpandedResults] = useState({});
  const navigate = useNavigate();

  const toggleResultExpansion = (quizId) => {
    setExpandedResults(prev => ({
      ...prev,
      [quizId]: !prev[quizId]
    }));
  };

  const fetchData = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      const [allQuizzes, allResults, allUsers] = await Promise.all([
        api.quizzes.getAll(),
        api.results.getAll(),
        api.users.getAll()
      ]);
      setQuizzes(allQuizzes.filter(q => q.createdBy === currentUser.id));
      setResults(allResults);
      setStudents(allUsers.filter(u => u.role === 'STUDENT'));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteQuiz = async () => {
    if (!selectedQuiz) return;
    setError('');
    try {
      await api.quizzes.delete(selectedQuiz._id);
      setQuizzes(quizzes.filter(q => q._id !== selectedQuiz._id));
      setShowDeleteConfirm(false);
      setSelectedQuiz(null);
      setSuccess('Quiz deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateScore = async (e) => {
    e.preventDefault();
    if (!selectedResult) return;
    setError('');
    try {
      const updatedResult = { ...selectedResult, score: parseInt(newScore) };
      await api.results.update(updatedResult);
      setResults(results.map(r => r._id === selectedResult._id ? updatedResult : r));
      setShowScoreUpdate(false);
      setSelectedResult(null);
      setNewScore('');
      setSuccess('Score updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const exportQuizResults = (quiz) => {
    const quizResults = results.filter(r => r.quizId === quiz._id);
    
    if (quizResults.length === 0) {
      setError('No results found for this quiz.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const data = quizResults.map(r => {
      // Find student details if not in result (for older results)
      const student = students.find(s => s._id === r.studentId);
      return {
        'Name': r.studentName,
        'Roll No': r.rollNo,
        'Department': r.department || student?.department || 'N/A',
        'Section': r.section || student?.section || 'N/A',
        'Score': `${r.score} / ${r.totalQuestions}`,
        'Submission Date': new Date(r.submittedAt).toLocaleString()
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
    
    // Generate file name
    const fileName = `${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Dashboard</h1>
          <p className="text-gray-500">Manage your quizzes and monitor student performance</p>
        </div>
        <Link
          to="/staff/create-quiz"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" /> Create New Quiz
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-500 hover:text-green-700">×</button>
        </div>
      )}

      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('quizzes')}
          className={`pb-4 px-4 font-medium transition-colors relative ${
            activeTab === 'quizzes' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          My Quizzes
          {activeTab === 'quizzes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-scale-in" />}
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`pb-4 px-4 font-medium transition-colors relative ${
            activeTab === 'students' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Student List
          {activeTab === 'students' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-scale-in" />}
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`pb-4 px-4 font-medium transition-colors relative ${
            activeTab === 'results' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Quiz Results
          {activeTab === 'results' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-scale-in" />}
        </button>
      </div>

      {activeTab === 'quizzes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up" key="quizzes">
          {quizzes.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-200">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No quizzes created yet. Start by creating one!</p>
            </div>
          ) : (
            quizzes.map(quiz => (
              <div key={quiz._id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-md hover:border-indigo-100/50 transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{quiz.title}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportQuizResults(quiz)}
                      className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                      title="Export Results to Excel"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => navigate(`/staff/edit-quiz/${quiz._id}`)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedQuiz(quiz);
                        setShowDeleteConfirm(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{quiz.description}</p>
                <div className="space-y-2 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{quiz.duration} Minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    <span>{quiz.questions.length} Questions</span>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {quiz.topic}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    new Date() > new Date(quiz.endTime) ? 'bg-red-100 text-red-700' :
                    new Date() < new Date(quiz.startTime) ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {new Date() > new Date(quiz.endTime) ? 'Ended' :
                     new Date() < new Date(quiz.startTime) ? 'Upcoming' : 'Active'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'students' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in-up" key="students">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Roll No</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Batch/Sec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map(student => (
                  <tr key={student._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{student.rollNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{student.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {student.batch} {student.section && `- ${student.section}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="space-y-6 animate-fade-in-up" key="results">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <span className="text-sm text-slate-500 font-medium">Grouped by Quiz</span>
            <button
              onClick={() => {
                const data = results.map(r => {
                  const student = students.find(s => s._id === r.studentId);
                  const quiz = quizzes.find(q => q._id === r.quizId);
                  return {
                    'Student Name': r.studentName,
                    'Roll No': r.rollNo,
                    'Quiz': quiz?.title || 'Deleted Quiz',
                    'Department': r.department || student?.department || 'N/A',
                    'Section': r.section || student?.section || 'N/A',
                    'Score': r.score,
                    'Total': r.totalQuestions,
                    'Submission Date': new Date(r.submittedAt).toLocaleString()
                  };
                });
                const worksheet = XLSX.utils.json_to_sheet(data);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "All Results");
                XLSX.writeFile(workbook, "all_quiz_results.xlsx");
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-green-700 transition-colors shadow-md shadow-green-100"
            >
              <Download className="w-4 h-4" /> Download All Results
            </button>
          </div>

          {quizzes.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-200">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No quizzes created yet. Create a quiz to view student results.</p>
            </div>
          ) : (
            quizzes.map(quiz => {
              const quizResults = results.filter(r => r.quizId === quiz._id);
              const isExpanded = !!expandedResults[quiz._id];

              return (
                <div key={quiz._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
                  {/* Quiz Summary Header Row */}
                  <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-gray-900">{quiz.title}</h3>
                      <p className="text-xs text-gray-500">
                        Topic: <span className="font-semibold text-gray-700">{quiz.topic}</span> • 
                        Duration: <span className="font-semibold text-gray-700">{quiz.duration}m</span> • 
                        Questions: <span className="font-semibold text-gray-700">{quiz.questions.length}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Attempts count badge */}
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                        quizResults.length > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {quizResults.length} {quizResults.length === 1 ? 'Attempt' : 'Attempts'}
                      </span>

                      {/* Export button for this quiz */}
                      {quizResults.length > 0 && (
                        <button
                          onClick={() => exportQuizResults(quiz)}
                          className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1.5"
                          title="Export results for this quiz to Excel"
                        >
                          <Download className="w-3.5 h-3.5" /> Export Excel
                        </button>
                      )}

                      {/* Expand / Collapse Toggle button */}
                      {quizResults.length > 0 && (
                        <button
                          onClick={() => toggleResultExpansion(quiz._id)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-850 px-3 py-1.5 rounded-xl border border-indigo-100 hover:bg-indigo-50/50 transition-all flex items-center gap-1"
                        >
                          <span>{isExpanded ? 'Hide Results' : 'View Results'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Results Table */}
                  {isExpanded && quizResults.length > 0 && (
                    <div className="border-t border-gray-100 overflow-x-auto animate-in slide-in-from-top duration-350">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50/50">
                          <tr className="border-b border-gray-100">
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Details</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Department / Sec</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted At</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {quizResults.map(result => {
                            const student = students.find(s => s._id === result.studentId);
                            const percentage = (result.score / result.totalQuestions) * 100;
                            return (
                              <tr key={result._id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-semibold text-gray-900 text-sm">{result.studentName}</div>
                                  <div className="text-xs text-gray-500 font-mono">{result.rollNo}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-sm">
                                  <div>{result.department || student?.department || 'N/A'}</div>
                                  <div className="text-xs text-gray-400">
                                    {result.section || student?.section || 'N/A'} • {student?.batch || 'N/A'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-gray-900 text-sm">{result.score}</span>
                                    <span className="text-gray-400 text-xs">/ {result.totalQuestions}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 ${
                                      percentage >= 50 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                    }`}>
                                      {Math.round(percentage)}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm font-mono">
                                  {new Date(result.submittedAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <button
                                    onClick={() => {
                                      setSelectedResult(result);
                                      setNewScore(result.score.toString());
                                      setShowScoreUpdate(true);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-colors"
                                  >
                                    Update Marks
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Delete Quiz</h2>
            <p className="text-gray-500 text-center mb-8">
              Are you sure you want to delete <span className="font-bold text-gray-900">{selectedQuiz?.title}</span>? All results associated with this quiz will remain but the quiz itself will be gone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedQuiz(null);
                  setError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteQuiz}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showScoreUpdate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Update Score</h2>
            <p className="text-gray-500 mb-6">Updating score for {selectedResult?.studentName}</p>
            <form onSubmit={handleUpdateScore} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Score (out of {selectedResult?.totalQuestions})</label>
                <input
                  type="number"
                  required
                  min="0"
                  max={selectedResult?.totalQuestions}
                  value={newScore}
                  onChange={(e) => setNewScore(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowScoreUpdate(false);
                    setSelectedResult(null);
                    setNewScore('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Update Score
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
