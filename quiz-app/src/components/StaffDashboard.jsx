import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Routes, Route, Link, useLocation, Outlet } from 'react-router-dom';
import { FaMagic } from 'react-icons/fa';
import '../styles/staff.css';
import EditProfileModal from './EditProfileModal';
import AIGenerateQuiz from './AIGenerateQuiz';

const StaffDashboard = ({ user, logout, updateUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [quizzes, setQuizzes] = useState([]);
  const isAIGenerator = location.pathname === '/staff/ai-generate';
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [questions, setQuestions] = useState([{ 
    questionText: '', 
    options: ['', '', '', ''], 
    correctAnswer: 0, 
    points: 1,
    image: null,
    imagePreview: ''
  }]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [department, setDepartment] = useState('');
  const [batch, setBatch] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const baseURL = process.env.NODE_ENV === 'development' 
        ? 'https://quizmoz.onrender.com' 
        : '';
        
      const response = await axios.get(`${baseURL}/api/quizzes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data?.success) {
        setQuizzes(response.data.quizzes);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      console.error('Error fetching quizzes:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch quizzes');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchResults = async (quizId) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/quizzes/${quizId}/results`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setResults(res.data.results);
      setSelectedQuiz(quizzes.find(q => q._id === quizId));
    } catch (err) {
      console.error('Error fetching results:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch results');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, { 
      questionText: '', 
      options: ['', '', '', ''], 
      correctAnswer: 0, 
      points: 1,
      image: null,
      imagePreview: ''
    }]);
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length > 1) {
      const newQuestions = [...questions];
      newQuestions.splice(index, 1);
      setQuestions(newQuestions);
    }
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuestions(newQuestions);
  };

  const handleImageUpload = (e, qIndex) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newQuestions = [...questions];
        newQuestions[qIndex].image = file;
        newQuestions[qIndex].imagePreview = reader.result;
        setQuestions(newQuestions);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (qIndex) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].image = null;
    newQuestions[qIndex].imagePreview = '';
    setQuestions(newQuestions);
  };

  const handleSubmitQuiz = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData();
    
    // Add text fields
    formData.append('title', quizTitle);
    formData.append('description', quizDescription);
    formData.append('questions', JSON.stringify(
        questions.map(q => ({
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points,
            _id: q._id || Date.now().toString() + Math.random().toString(36).substr(2, 9) // Add temporary ID for reference
        }))
    ));
    formData.append('startTime', startTime);
    formData.append('endTime', endTime);
    formData.append('duration', duration.toString());
    formData.append('department', department || '');
    formData.append('batch', batch || '');

    // Add image files
    questions.forEach((q, index) => {
        if (q.image) {
            formData.append('questionImages', q.image);
        }
    });

    try {
        let response;
        
        if (isEditMode && editingQuiz) {
          // Update existing quiz
          response = await axios.put(`/api/quizzes/${editingQuiz._id}`, {
            title: quizTitle,
            description: quizDescription,
            questions: questions.map(q => ({
              questionText: q.questionText,
              options: q.options,
              correctAnswer: q.correctAnswer,
              points: q.points
            })),
            startTime,
            endTime,
            duration,
            department,
            batch
          }, {
            headers: { 
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          });
        } else {
          // Create new quiz
          response = await axios.post('/api/quizzes', formData, {
            headers: { 
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'multipart/form-data'
            }
          });
        }
        
        setShowQuizForm(false);
        resetForm();
        fetchQuizzes();
    } catch (err) {
        console.error('Error:', err);
        setError(err.response?.data?.message || err.message || `Failed to ${isEditMode ? 'update' : 'create'} quiz`);
    } finally {
        setIsLoading(false);
    }
  };

  const resetForm = () => {
    setQuizTitle('');
    setQuizDescription('');
    setQuestions([{ 
      questionText: '', 
      options: ['', '', '', ''], 
      correctAnswer: 0, 
      points: 1,
      image: null,
      imagePreview: ''
    }]);
    setStartTime('');
    setEndTime('');
    setDuration(30);
    setDepartment('');
    setBatch('');
    setError('');
    setIsEditMode(false);
    setEditingQuiz(null);
  };

  const exportResults = async (quizId) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.get(`/api/quizzes/${quizId}/results/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quiz_results_${quizId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting results:', err);
      setError(err.response?.data?.message || err.message || 'Failed to export results');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteQuiz = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return;
    
    setIsLoading(true);
    setError('');
    try {
      await axios.delete(`/api/quizzes/${quizId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchQuizzes();
    } catch (err) {
      console.error('Error deleting quiz:', err);
      setError(err.response?.data?.message || err.message || 'Failed to delete quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const editQuiz = (quiz) => {
    setEditingQuiz(quiz);
    setIsEditMode(true);
    setQuizTitle(quiz.title);
    setQuizDescription(quiz.description || '');
    setQuestions(quiz.questions.map(q => ({
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      points: q.points,
      image: null,
      imagePreview: ''
    })));
    setStartTime(new Date(quiz.startTime).toISOString().slice(0, 16));
    setEndTime(new Date(quiz.endTime).toISOString().slice(0, 16));
    setDuration(quiz.duration);
    setDepartment(quiz.department || '');
    setBatch(quiz.batch || '');
    setShowQuizForm(true);
  };

  const publishQuiz = async (quizId) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.put(`/api/quizzes/${quizId}/publish`, 
        { status: 'published' },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      if (response.data.success) {
        fetchQuizzes();
        alert('Quiz published successfully! Students can now attend this quiz.');
      }
    } catch (err) {
      console.error('Error publishing quiz:', err);
      setError(err.response?.data?.message || err.message || 'Failed to publish quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const unpublishQuiz = async (quizId) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.put(`/api/quizzes/${quizId}/publish`, 
        { status: 'draft' },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      if (response.data.success) {
        fetchQuizzes();
        alert('Quiz unpublished. Students can no longer attend this quiz.');
      }
    } catch (err) {
      console.error('Error unpublishing quiz:', err);
      setError(err.response?.data?.message || err.message || 'Failed to unpublish quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfileUpdate = (updatedUser) => {
    // Update the user data in the parent component
    if (typeof updateUser === 'function') {
      updateUser(updatedUser);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  // Navigation and state hooks

  return (
    <div className="staff-dashboard">
      <header>
        <h1>Staff Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {user.name}</span>
          <div className="header-buttons">
            <button 
              onClick={() => setShowEditProfile(true)} 
              className="btn btn-secondary"
            >
              Edit Profile
            </button>
            <button onClick={logout} className="btn btn-danger">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="staff-nav">
        <button 
          className={`nav-btn ${!isAIGenerator ? 'active' : ''}`}
          onClick={() => navigate('/staff/dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={`nav-btn ${isAIGenerator ? 'active' : ''}`}
          onClick={() => navigate('/staff/ai-generate')}
        >
          <FaMagic /> AI Quiz Generator
        </button>
      </div>
      
      {!isAIGenerator && (
        <div className="dashboard-actions">
          <button 
            onClick={() => setShowQuizForm(true)} 
            className="btn btn-primary"
          >
            Create New Quiz
          </button>
        </div>
      )}
      
      {showEditProfile && (
        <EditProfileModal 
          user={user} 
          onClose={() => setShowEditProfile(false)}
          onUpdate={handleProfileUpdate}
        />
      )}

      <div className="staff-content">
        {error && <div className="error-message">{error}</div>}
        
        {/* Nested Routes */}
        <Outlet />
        
        {!isAIGenerator && (
          <>
            {isLoading && <div className="loading-overlay">Loading...</div>}

        <div className="quiz-management">
          <h2>Quiz Management</h2>
          {quizzes.length > 0 ? (
            <div className="quiz-table-container">
              <table className="quiz-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Duration</th>
                    <th>Department</th>
                    <th>Batch</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map(quiz => (
                    <tr key={quiz._id}>
                      <td>{quiz.title}</td>
                      <td>
                        <span className={`status-badge ${quiz.status === 'published' ? 'published' : 'draft'}`}>
                          {quiz.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td>{new Date(quiz.startTime).toLocaleString()}</td>
                      <td>{new Date(quiz.endTime).toLocaleString()}</td>
                      <td>{quiz.duration} mins</td>
                      <td>{quiz.department || '-'}</td>
                      <td>{quiz.batch || '-'}</td>
                      <td className="actions-cell">
                        <button 
                          onClick={() => fetchResults(quiz._id)}
                          className="view-results-btn"
                        >
                          View Results
                        </button>
                        <button 
                          onClick={() => editQuiz(quiz)}
                          className="edit-btn"
                        >
                          Edit
                        </button>
                        {quiz.status === 'published' ? (
                          <button 
                            onClick={() => unpublishQuiz(quiz._id)}
                            className="unpublish-btn"
                          >
                            Unpublish
                          </button>
                        ) : (
                          <button 
                            onClick={() => publishQuiz(quiz._id)}
                            className="publish-btn"
                          >
                            Publish
                          </button>
                        )}
                        <button 
                          onClick={() => exportResults(quiz._id)}
                          className="export-btn"
                        >
                          Export
                        </button>
                        <button 
                          onClick={() => deleteQuiz(quiz._id)}
                          className="delete-btn"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-quizzes">No quizzes created yet</p>
          )}
        </div>

        <Routes>
          <Route path="ai-generate" element={
            <AIGenerateQuiz user={user} onBack={() => navigate('/staff')} />
          } />
        </Routes>

        {showQuizForm && (
          <div 
            className="quiz-form-overlay" 
            onClick={() => {
              setShowQuizForm(false);
              resetForm();
            }}
          >
            <div 
              className="quiz-form"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{isEditMode ? 'Edit Quiz' : 'Create New Quiz'}</h2>
              
              <form onSubmit={handleSubmitQuiz}>
                <div className="form-group">
                  <label>Quiz Title *</label>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={quizDescription}
                    onChange={(e) => setQuizDescription(e.target.value)}
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>End Time *</label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Duration (minutes) *</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      min="1"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Department (optional)</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Batch (optional)</label>
                    <input
                      type="text"
                      value={batch}
                      onChange={(e) => setBatch(e.target.value)}
                    />
                  </div>
                </div>
                
                <h3>Questions *</h3>
                {questions.map((q, qIndex) => (
                  <div key={qIndex} className="question-group">
                    <div className="form-group">
                      <label>Question {qIndex + 1} *</label>
                      <input
                        type="text"
                        value={q.questionText}
                        onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Points *</label>
                      <input
                        type="number"
                        value={q.points}
                        onChange={(e) => handleQuestionChange(qIndex, 'points', parseInt(e.target.value))}
                        min="1"
                        required
                      />
                    </div>
                    
<div className="form-group">
  <label>Question Image (optional)</label>
  {q.imagePreview ? (
    <div className="image-preview-container">
      <img 
        src={q.imagePreview} 
        alt="Question preview" 
        className="image-preview"
      />
      <button
        type="button"
        onClick={() => removeImage(qIndex)}
        className="remove-image-btn"
      >
        Remove Image
      </button>
    </div>
  ) : (
    <input
      type="file"
      accept="image/*"
      onChange={(e) => handleImageUpload(e, qIndex)}
    />
  )}
</div>
                    
                    <div className="options-group">
                      {q.options.map((option, oIndex) => (
                        <div key={oIndex} className="option-row">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                            required
                            placeholder={`Option ${oIndex + 1}`}
                          />
                          <label className="correct-option-label">
                            <input
                              type="radio"
                              name={`correctAnswer-${qIndex}`}
                              checked={q.correctAnswer === oIndex}
                              onChange={() => handleQuestionChange(qIndex, 'correctAnswer', oIndex)}
                            />
                            Correct
                          </label>
                        </div>
                      ))}
                    </div>
                    
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIndex)}
                        className="remove-question-btn"
                      >
                        Remove Question
                      </button>
                    )}
                  </div>
                ))}
                
                <button 
                  type="button" 
                  onClick={handleAddQuestion}
                  className="add-question-btn"
                >
                  Add Question
                </button>
                
                <div className="form-actions">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowQuizForm(false);
                      resetForm();
                    }}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="submit-btn"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating...' : 'Create Quiz'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedQuiz && (
          <div className="results-overlay">
            <div className="results-container">
              <div className="results-header">
                <h2>Results for {selectedQuiz.title}</h2>
                <button 
                  onClick={() => setSelectedQuiz(null)}
                  className="back-button"
                  title="Back to dashboard"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                  Back to Dashboard
                </button>
              </div>
              
              {results.length > 0 ? (
                <div className="results-table-container">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Roll Number</th>
                        <th>Score</th>
                        <th>Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map(result => (
                        <tr key={result._id}>
                          <td>{result.user?.name || 'Unknown'}</td>
                          <td>{result.user?.rollNumber || 'N/A'}</td>
                          <td>{result.score}</td>
                          <td>{new Date(result.submittedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-results-container">
                  <p className="no-results">No results available for this quiz</p>
                  <button 
                    onClick={() => setSelectedQuiz(null)}
                    className="back-button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12"></line>
                      <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    Back to Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
