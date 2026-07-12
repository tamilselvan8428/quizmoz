import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Plus, Edit, Trash2, ClipboardList, Clock, Download, ChevronDown, ChevronUp, AlertCircle, BookOpen, FileText, X, Loader2, Folder, FolderOpen } from 'lucide-react';
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
  const [expandedFolders, setExpandedFolders] = useState({});
  const [studyMaterials, setStudyMaterials] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    topic: '',
    description: '',
  });
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setError('');
    const newFiles = [];
    let loadedCount = 0;

    files.forEach(file => {
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
        setError(`File ${file.name} is too large (max 20MB).`);
        setTimeout(() => setError(''), 3000);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        newFiles.push({
          fileContent: reader.result,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        });
        loadedCount++;
        if (loadedCount === files.length) {
          setSelectedFiles(prev => [...prev, ...newFiles]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeQueuedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadMaterial = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError('Please select at least one file to upload.');
      return;
    }

    setUploading(true);
    setError('');

    const isMultiple = selectedFiles.length > 1;
    const folderId = isMultiple ? crypto.randomUUID() : undefined;
    const folderName = isMultiple ? (uploadForm.title || 'Untitled Folder') : undefined;

    try {
      const uploadPromises = selectedFiles.map(file => {
        const payload = {
          title: isMultiple ? file.fileName : (uploadForm.title || file.fileName),
          topic: uploadForm.topic,
          description: uploadForm.description,
          fileContent: file.fileContent,
          fileName: file.fileName,
          fileType: file.fileType || 'application/octet-stream',
          fileSize: file.fileSize,
          folderId,
          folderName
        };
        return api.studyMaterials.save(payload);
      });

      const newMaterials = await Promise.all(uploadPromises);
      const failed = newMaterials.find(m => m.error);
      if (failed) {
        throw new Error(failed.error);
      }

      // Refresh to group them properly
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      const allMaterials = await api.studyMaterials.getAll();
      setStudyMaterials(allMaterials.filter(m => m.uploadedBy === currentUser.id));

      setShowUploadModal(false);
      setUploadForm({
        title: '',
        topic: '',
        description: '',
      });
      setSelectedFiles([]);
      setSuccess('Study materials uploaded successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to upload materials: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!window.confirm('Are you sure you want to delete this study material?')) return;
    setError('');
    try {
      await api.studyMaterials.delete(id);
      setStudyMaterials(studyMaterials.filter(m => m._id !== id));
      setSuccess('Study material deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to delete material: ' + err.message);
    }
  };

  const handleDeleteFolder = async (folderId, files) => {
    if (!window.confirm(`Are you sure you want to delete this folder and all its ${files.length} files?`)) return;
    setError('');
    try {
      const deletePromises = files.map(file => api.studyMaterials.delete(file._id));
      await Promise.all(deletePromises);
      setStudyMaterials(studyMaterials.filter(m => m.folderId !== folderId));
      setSuccess('Folder deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to delete folder: ' + err.message);
    }
  };

  const toggleResultExpansion = (quizId) => {
    setExpandedResults(prev => ({
      ...prev,
      [quizId]: !prev[quizId]
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

  const fetchData = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
      const [allQuizzes, allResults, allUsers, allMaterials] = await Promise.all([
        api.quizzes.getAll(),
        api.results.getAll(),
        api.users.getAll(),
        api.studyMaterials.getAll()
      ]);
      setQuizzes(allQuizzes.filter(q => q.createdBy === currentUser.id));
      setResults(allResults);
      setStudents(allUsers.filter(u => u.role === 'STUDENT'));
      setStudyMaterials(allMaterials.filter(m => m.uploadedBy === currentUser.id));
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
    <div className="space-y-8 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Staff Dashboard</h1>
          <p className="text-slate-450 mt-1">Manage your quizzes and monitor student performance</p>
        </div>
        {activeTab === 'materials' ? (
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-[#2059a1] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#1a4b87] transition-all shadow-lg shadow-[#2059a1]/10"
          >
            <Plus className="w-5 h-5" /> Upload Document
          </button>
        ) : (
          <Link
            to="/staff/create-quiz"
            className="bg-[#2059a1] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#1a4b87] transition-all shadow-lg shadow-[#2059a1]/10"
          >
            <Plus className="w-5 h-5" /> Create New Quiz
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-955/50 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-450 hover:text-red-300 font-bold">×</button>
        </div>
      )}

      {success && (
        <div className="bg-green-955/50 border border-green-900/50 text-green-400 px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-450 hover:text-green-300 font-bold">×</button>
        </div>
      )}

      <div className="flex gap-4 border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('quizzes')}
          className={`pb-4 px-4 font-bold text-sm transition-colors relative whitespace-nowrap ${
            activeTab === 'quizzes' ? 'text-yellow-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          My Quizzes
          {activeTab === 'quizzes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 animate-scale-in" />}
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`pb-4 px-4 font-bold text-sm transition-colors relative whitespace-nowrap ${
            activeTab === 'students' ? 'text-yellow-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Student List
          {activeTab === 'students' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 animate-scale-in" />}
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`pb-4 px-4 font-bold text-sm transition-colors relative whitespace-nowrap ${
            activeTab === 'results' ? 'text-yellow-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Quiz Results
          {activeTab === 'results' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 animate-scale-in" />}
        </button>
        <button
          onClick={() => setActiveTab('materials')}
          className={`pb-4 px-4 font-bold text-sm transition-colors relative whitespace-nowrap ${
            activeTab === 'materials' ? 'text-yellow-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Study Materials
          {activeTab === 'materials' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 animate-scale-in" />}
        </button>
      </div>

      {activeTab === 'quizzes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up" key="quizzes">
          {quizzes.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-800">
              <ClipboardList className="w-12 h-12 text-slate-650 mx-auto mb-4" />
              <p className="text-slate-400 font-semibold">No quizzes created yet. Start by creating one!</p>
            </div>
          ) : (
            quizzes.map(quiz => (
              <div key={quiz._id} className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80 flex flex-col hover:-translate-y-1 hover:shadow-2xl hover:border-yellow-500/20 transition-all duration-300 text-white">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-white">{quiz.title}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportQuizResults(quiz)}
                      className="p-1.5 text-slate-450 hover:text-green-400 transition-colors"
                      title="Export Results to Excel"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => navigate(`/staff/edit-quiz/${quiz._id}`)}
                      className="p-1.5 text-slate-455 hover:text-[#ecbf21] transition-colors"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedQuiz(quiz);
                        setShowDeleteConfirm(true);
                      }}
                      className="p-1.5 text-slate-455 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <p className="text-slate-350 text-sm mb-4 line-clamp-2">{quiz.description}</p>
                <div className="space-y-2 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>{quiz.duration} Minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-slate-500" />
                    <span>{quiz.questions.length} Questions</span>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-850 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {quiz.topic}
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    new Date() > new Date(quiz.endTime) ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                    new Date() < new Date(quiz.startTime) ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                    'bg-green-500/10 border-green-500/20 text-green-400'
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
        <div className="bg-slate-900 border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up" key="students">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-850">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-450 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-455 uppercase tracking-wider">Roll No</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-455 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-455 uppercase tracking-wider">Batch/Sec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {students.map(student => (
                  <tr key={student._id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-white">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-350">{student.rollNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-350">{student.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-350">
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
          <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl">
            <span className="text-sm text-slate-400 font-bold">Grouped by Quiz</span>
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
              className="bg-green-650 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-750 transition-colors shadow-lg shadow-green-600/10"
            >
              <Download className="w-4 h-4" /> Download All Results
            </button>
          </div>

          {quizzes.length === 0 ? (
            <div className="py-12 text-center bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-800">
              <ClipboardList className="w-12 h-12 text-slate-650 mx-auto mb-4" />
              <p className="text-slate-400 font-bold">No quizzes created yet. Create a quiz to view student results.</p>
            </div>
          ) : (
            quizzes.map(quiz => {
              const quizResults = results.filter(r => r.quizId === quiz._id);
              const isExpanded = !!expandedResults[quiz._id];

              return (
                <div key={quiz._id} className="bg-slate-900/40 rounded-2xl border border-slate-800 shadow-xl overflow-hidden transition-all text-white">
                  {/* Quiz Summary Header Row */}
                  <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40 border-b border-slate-850/80">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-white">{quiz.title}</h3>
                      <p className="text-xs text-slate-400">
                        Topic: <span className="font-semibold text-slate-200">{quiz.topic}</span> • 
                        Duration: <span className="font-semibold text-slate-200">{quiz.duration}m</span> • 
                        Questions: <span className="font-semibold text-slate-200">{quiz.questions.length}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Attempts count badge */}
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                        quizResults.length > 0 ? 'bg-indigo-950/50 text-indigo-400 border border-indigo-900/30' : 'bg-slate-800 text-slate-450'
                      }`}>
                        {quizResults.length} {quizResults.length === 1 ? 'Attempt' : 'Attempts'}
                      </span>

                      {/* Export button for this quiz */}
                      {quizResults.length > 0 && (
                        <button
                          onClick={() => exportQuizResults(quiz)}
                          className="bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-emerald-900 transition-all flex items-center gap-1.5"
                          title="Export results for this quiz to Excel"
                        >
                          <Download className="w-3.5 h-3.5" /> Export Excel
                        </button>
                      )}

                      {/* Expand / Collapse Toggle button */}
                      {quizResults.length > 0 && (
                        <button
                          onClick={() => toggleResultExpansion(quiz._id)}
                          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-xl border border-indigo-900/40 hover:bg-[#2059a1]/10 transition-all flex items-center gap-1"
                        >
                          <span>{isExpanded ? 'Hide Results' : 'View Results'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Results Table */}
                  {isExpanded && quizResults.length > 0 && (
                    <div className="border-t border-slate-850 overflow-x-auto animate-in slide-in-from-top duration-350">
                      <table className="w-full text-left">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-850">
                          <tr>
                            <th className="px-6 py-3 text-xs font-bold text-slate-450 uppercase tracking-wider">Student Details</th>
                            <th className="px-6 py-3 text-xs font-bold text-slate-455 uppercase tracking-wider">Department / Sec</th>
                            <th className="px-6 py-3 text-xs font-bold text-slate-455 uppercase tracking-wider">Score</th>
                            <th className="px-6 py-3 text-xs font-bold text-slate-455 uppercase tracking-wider">Submitted At</th>
                            <th className="px-6 py-3 text-xs font-bold text-slate-455 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {quizResults.map(result => {
                            const student = students.find(s => s._id === result.studentId);
                            const percentage = (result.score / result.totalQuestions) * 100;
                            return (
                              <tr key={result._id} className="hover:bg-slate-850/40 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-semibold text-white text-sm">{result.studentName}</div>
                                  <div className="text-xs text-slate-500 font-mono">{result.rollNo}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-slate-350 text-sm">
                                  <div>{result.department || student?.department || 'N/A'}</div>
                                  <div className="text-xs text-slate-500">
                                    {result.section || student?.section || 'N/A'} • {student?.batch || 'N/A'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-white text-sm">{result.score}</span>
                                    <span className="text-slate-500 text-xs">/ {result.totalQuestions}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ml-2 ${
                                      percentage >= 50 ? 'bg-emerald-950 border-emerald-900/40 text-emerald-450' : 'bg-red-955/50 border-red-900/50 text-red-400'
                                    }`}>
                                      {Math.round(percentage)}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-slate-400 text-sm font-mono">
                                  {new Date(result.submittedAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <button
                                    onClick={() => {
                                      setSelectedResult(result);
                                      setNewScore(result.score.toString());
                                      setShowScoreUpdate(true);
                                    }}
                                    className="text-indigo-400 hover:text-indigo-300 text-xs font-bold transition-colors"
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
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/25 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white text-center mb-2">Delete Quiz</h2>
            <p className="text-slate-350 text-center mb-8 text-sm leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-white">{selectedQuiz?.title}</span>? All results associated with this quiz will remain but the quiz itself will be gone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedQuiz(null);
                  setError('');
                }}
                className="flex-1 px-4 py-2.5 border border-slate-800 text-slate-300 rounded-xl hover:bg-slate-850 transition-colors font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteQuiz}
                className="flex-1 px-4 py-2.5 bg-red-650 text-white rounded-xl hover:bg-red-750 transition-colors font-bold text-sm shadow-lg shadow-red-600/15"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showScoreUpdate && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <h2 className="text-2xl font-black text-white mb-2">Update Score</h2>
            <p className="text-slate-350 text-sm mb-6">Updating score for {selectedResult?.studentName}</p>
            <form onSubmit={handleUpdateScore} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">New Score (out of {selectedResult?.totalQuestions})</label>
                <input
                  type="number"
                  required
                  min="0"
                  max={selectedResult?.totalQuestions}
                  value={newScore}
                  onChange={(e) => setNewScore(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500 transition-all"
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
                  className="flex-1 px-4 py-2.5 border border-slate-800 text-slate-300 rounded-xl hover:bg-slate-850 transition-colors font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#2059a1] text-white rounded-xl hover:bg-[#1a4b87] transition-colors font-bold text-sm shadow-lg shadow-[#2059a1]/15"
                >
                  Update Score
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up" key="materials">
          {studyMaterials.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-800 animate-fade-in">
              <BookOpen className="w-12 h-12 text-slate-655 mx-auto mb-4 animate-pulse" />
              <p className="text-slate-400 font-bold">No study materials uploaded yet. Click "Upload Document" to start!</p>
            </div>
          ) : (
            groupMaterialsByFolder(studyMaterials).map(item => {
              if (item.isFolder) {
                const isExpanded = expandedFolders[item.folderId];
                return (
                  <div key={item.folderId} className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex flex-col hover:shadow-2xl hover:border-yellow-500/20 transition-all duration-300 relative col-span-full text-white">
                    <div className="flex justify-between items-start mb-4 pr-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-yellow-550/10 border border-yellow-500/20 rounded-xl text-yellow-500">
                          {isExpanded ? <FolderOpen className="w-8 h-8 fill-yellow-500/10 animate-bounce" /> : <Folder className="w-8 h-8 fill-yellow-500/5" />}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {item.title}
                            <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full font-bold">
                              {item.files.length} Files
                            </span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 font-semibold">
                            Created on {new Date(item.createdAt).toLocaleDateString()} • {item.topic || 'General'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 absolute top-6 right-6">
                        <button
                          onClick={() => toggleFolderExpansion(item.folderId)}
                          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 focus:outline-none bg-slate-950 border border-slate-850 px-3 py-1.5 rounded-xl shadow-sm"
                        >
                          {isExpanded ? 'Hide Files' : 'Open Folder'}
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(item.folderId, item.files)}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800/45 rounded-xl transition-all"
                          title="Delete Folder & All Files"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-slate-350 text-sm mb-4 bg-slate-950/60 p-3 border border-slate-850 rounded-xl">{item.description}</p>
                    )}

                    {isExpanded && (
                      <div className="mt-4 border-t border-slate-850 pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
                        {item.files.map(file => (
                          <div key={file._id} className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 relative flex flex-col justify-between">
                            <button
                              onClick={() => handleDeleteMaterial(file._id)}
                              className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800/45 rounded-lg transition-colors"
                              title="Delete file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <div className="mb-3 pr-6">
                              <h4 className="font-semibold text-white text-sm truncate">{file.title}</h4>
                              <p className="text-slate-500 text-[10px] mt-0.5 truncate">{file.fileName}</p>
                            </div>

                            <button
                              onClick={() => {
                                const linkSource = file.fileContent;
                                const downloadLink = document.createElement("a");
                                downloadLink.href = linkSource;
                                downloadLink.download = file.fileName;
                                downloadLink.click();
                              }}
                              className="w-full bg-slate-900 border border-slate-800 text-slate-300 py-1.5 rounded-xl text-xs font-semibold hover:bg-slate-850 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // Standalone document
              return (
                <div key={item._id} className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex flex-col hover:-translate-y-1 hover:shadow-2xl hover:border-yellow-500/20 transition-all duration-300 relative text-white">
                  <button
                    onClick={() => handleDeleteMaterial(item._id)}
                    className="absolute top-4 right-4 p-2 text-slate-505 hover:text-red-400 hover:bg-slate-800/45 rounded-xl transition-all"
                    title="Delete Study Material"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex justify-between items-start mb-3 pr-8">
                    <div className="flex items-center gap-2 bg-indigo-950/50 border border-indigo-900/40 text-indigo-400 px-3 py-1 rounded-full text-xs font-bold">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{item.topic || 'General'}</span>
                    </div>
                    {item.fileSize && (
                      <span className="text-xs text-slate-500 font-semibold">
                        {Math.round(item.fileSize / 1024)} KB
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-slate-350 text-sm mb-4 flex-1 leading-relaxed">{item.description || 'No description provided.'}</p>
                  
                  <div className="border-t border-slate-850 pt-3 flex items-center justify-between text-xs text-slate-500 mb-3 font-semibold">
                    <span>Uploader: <strong className="text-slate-350 font-bold">{item.uploaderName}</strong></span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>

                  {item.fileContent && (
                    <button
                      onClick={() => {
                        const linkSource = item.fileContent;
                        const downloadLink = document.createElement("a");
                        downloadLink.href = linkSource;
                        downloadLink.download = item.fileName;
                        downloadLink.click();
                      }}
                      className="w-full bg-slate-950 border border-slate-850 text-slate-300 py-2.5 rounded-xl font-bold hover:bg-slate-850 transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4 text-slate-400" /> Download Document
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Upload Study Material Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-2xl max-w-lg w-full p-8 max-h-[90vh] flex flex-col animate-scale-in relative text-left overflow-hidden">
            <button
              onClick={() => {
                setShowUploadModal(false);
                setUploadForm({
                  title: '',
                  topic: '',
                  description: '',
                  fileContent: '',
                  fileName: '',
                  fileType: '',
                  fileSize: 0
                });
                setError('');
              }}
              className="absolute top-6 right-6 p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="border-b border-slate-850 pb-4 shrink-0">
              <h2 className="text-2xl font-black text-white">Upload Study Material</h2>
              <p className="text-sm text-slate-400 mt-1">Share documents with students for their preparation.</p>
            </div>

            <form onSubmit={handleUploadMaterial} className="flex flex-col flex-1 overflow-hidden space-y-4 mt-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Document Title</label>
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Introduction to React (Optional for multiple files)"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Topic / Subject</label>
                  <input
                    type="text"
                    value={uploadForm.topic}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, topic: e.target.value }))}
                    placeholder="e.g. Web Development"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none font-medium placeholder-slate-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Provide a brief summary of this document..."
                    rows="3"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-[#2059a1] text-white outline-none resize-none font-medium placeholder-slate-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Upload File(s) *</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-800 border-dashed rounded-2xl bg-slate-950 hover:bg-slate-850/40 transition-colors">
                    <div className="space-y-1 text-center">
                      <FileText className="mx-auto h-12 w-12 text-slate-550" />
                      <div className="flex text-sm text-slate-400 justify-center">
                        <label className="relative cursor-pointer rounded-md font-semibold text-yellow-400 hover:text-yellow-550">
                          <span>Select files</span>
                          <input
                            type="file"
                            multiple
                            required={selectedFiles.length === 0}
                            onChange={handleFileChange}
                            className="sr-only"
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">PDF, TXT, DOC, XLSX, JPG (Max 20MB per file)</p>
                    </div>
                  </div>
                  {selectedFiles.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-36 overflow-y-auto pr-1">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-indigo-950/40 border border-indigo-900/35 rounded-xl text-xs text-indigo-300 animate-scale-in">
                          <span className="font-semibold truncate pr-2">{file.fileName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 shrink-0">({Math.round(file.fileSize / 1024)} KB)</span>
                            <button
                              type="button"
                              onClick={() => removeQueuedFile(idx)}
                              className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-all"
                              title="Remove file"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-850 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadForm({
                      title: '',
                      topic: '',
                      description: '',
                    });
                    setSelectedFiles([]);
                    setError('');
                  }}
                  className="flex-1 px-4 py-3 border border-slate-800 text-slate-300 font-semibold rounded-xl hover:bg-slate-850 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || selectedFiles.length === 0}
                  className="flex-1 px-4 py-3 bg-[#2059a1] text-white font-semibold rounded-xl hover:bg-[#1a4b87] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload Document(s)'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
