import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSpinner, FaMagic, FaArrowLeft } from 'react-icons/fa';
import axios from 'axios';
import '../styles/ai-generate-quiz.css';

const AIGenerateQuiz = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    text: '',
    topics: '',
    numQuestions: 5,
    startTime: '',
    endTime: '',
    duration: ''
  });
  const [previewQuiz, setPreviewQuiz] = useState(null);
  const navigate = useNavigate();
  
  // Use environment variable with fallback
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGenerateQuiz = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Validate input
      if (!formData.text && !formData.topics) {
        throw new Error('Please provide either content text or topics');
      }

      const requestData = {
        text: formData.text.trim(),
        topics: formData.topics.trim(),
        options: {
          numQuestions: parseInt(formData.numQuestions) || 5,
          difficulty: 'medium'
        }
      };

      console.log('Sending request:', requestData);

      const response = await axios.post(
        `${baseURL}/api/ai/generate-quiz`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        }
      );

      console.log('Response received:', response.data);

      if (response.data.success) {
        setPreviewQuiz(response.data.quiz);
        setSuccess('Quiz generated successfully! Review and save it below.');
      } else {
        throw new Error(response.data.message || 'Failed to generate quiz');
      }
    } catch (err) {
      console.error('Error generating quiz:', err);
      const errorMessage = err.response?.data?.message || 
                          err.message || 
                          'Failed to generate quiz. Please check your API key and connection.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuiz = async () => {
    if (!previewQuiz) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        navigate('/login');
        return;
      }

      // Prepare quiz data for saving
      const quizData = {
        title: formData.title || previewQuiz.title || 'AI Generated Quiz',
        description: formData.description || previewQuiz.description || '',
        questions: previewQuiz.questions.map((q, index) => {
          // Normalize options to array of strings
          const optionsArray = Array.isArray(q.options) ? q.options : [];
          const normalizedOptions = optionsArray.length > 0
            ? optionsArray.map((opt, i) => {
                if (typeof opt === 'string') return opt;
                // handle { label, text } or other shapes
                if (opt && typeof opt === 'object') return opt.text || `Option ${String.fromCharCode(65 + i)}`;
                return `Option ${String.fromCharCode(65 + i)}`;
              })
            : ['Option A', 'Option B', 'Option C', 'Option D'];

          // Compute correct answer index (Number)
          let correctIndex = 0;
          if (typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < normalizedOptions.length) {
            correctIndex = q.correctAnswer;
          } else if (typeof q.correctAnswer === 'string') {
            // If letter like 'A'/'B' or 'A.' etc.
            const letter = q.correctAnswer.trim().toUpperCase().replace(/[^A-D]/g, '');
            if (letter >= 'A' && letter <= 'D') {
              correctIndex = letter.charCodeAt(0) - 65;
            } else {
              // Try to match by label from original options if present
              const labeledIndex = (Array.isArray(q.options) ? q.options : []).findIndex((opt, i) => {
                return opt && typeof opt === 'object' && typeof opt.label === 'string' && opt.label.toUpperCase() === q.correctAnswer.toUpperCase();
              });
              if (labeledIndex >= 0) correctIndex = labeledIndex;
            }
          }

          return {
            questionText: q.questionText || q.question || `Question ${index + 1}`,
            options: normalizedOptions,
            correctAnswer: correctIndex,
            points: q.marks || q.points || 1,
            explanation: q.explanation || 'Generated by AI'
          };
        }),
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        duration: formData.duration ? parseInt(formData.duration) : undefined,
        isActive: true
      };

      console.log('Saving quiz:', quizData);

      const response = await axios.post(
        `${baseURL}/api/quizzes`,
        quizData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setSuccess('Quiz saved successfully! Redirecting...');
        setTimeout(() => {
          navigate('/staff'); 
        }, 2000);
      }
    } catch (err) {
      console.error('Error saving quiz:', err);
      setError(err.response?.data?.message || 'Failed to save quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEdit = () => {
    setPreviewQuiz(null);
    setError('');
    setSuccess('');
  };

  return (
    <div className="ai-generate-quiz">
      <div className="page-header">
        <h2><FaMagic className="icon" /> AI Quiz Generator</h2>
        <p>Generate quizzes automatically using AI based on your content or topics</p>
      </div>
      
      {!previewQuiz ? (
        <div className="generator-form">
          <form onSubmit={handleGenerateQuiz}>
            <div className="form-section">
              <h3>Quiz Information</h3>
              <div className="form-group">
                <label>Quiz Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter quiz title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter quiz description"
                  rows="3"
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Content Input</h3>
              <div className="form-group">
                <label>Content to Generate Questions From (Optional)</label>
                <textarea
                  name="text"
                  value={formData.text}
                  onChange={handleInputChange}
                  placeholder="Paste your content here... (textbooks, articles, notes, etc.)"
                  rows="6"
                />
                <small>Provide detailed content for context-aware question generation</small>
              </div>

              <div className="form-group">
                <label>Topics (Comma-separated) *</label>
                <input
                  type="text"
                  name="topics"
                  value={formData.topics}
                  onChange={handleInputChange}
                  placeholder="e.g., Microprocessors, Computer Architecture, Embedded Systems"
                  required
                />
                <small>Provide at least one topic if no content text is provided</small>
              </div>
            </div>

            <div className="form-section">
              <h3>Generation Options</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Number of Questions</label>
                  <input
                    type="number"
                    name="numQuestions"
                    min="1"
                    max="20"
                    value={formData.numQuestions}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Schedule (Optional)</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date & Time</label>
                  <input
                    type="datetime-local"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>End Date & Time</label>
                  <input
                    type="datetime-local"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Duration (minutes)</label>
                  <input
                    type="number"
                    name="duration"
                    min="1"
                    value={formData.duration}
                    onChange={handleInputChange}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/quizzes')}
              >
                <FaArrowLeft /> Back to Quizzes
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading || (!formData.text && !formData.topics)}
              >
                {loading ? (
                  <>
                    <FaSpinner className="spin" /> Generating...
                  </>
                ) : (
                  <>
                    <FaMagic /> Generate Quiz
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="preview-container">
          <div className="preview-header">
            <h3>Preview Generated Quiz</h3>
            <div className="preview-actions">
              <button 
                className="btn btn-secondary"
                onClick={handleBackToEdit}
                disabled={loading}
              >
                <FaArrowLeft /> Back to Editor
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSaveQuiz}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <FaSpinner className="spin" /> Saving...
                  </>
                ) : (
                  'Save Quiz'
                )}
              </button>
            </div>
          </div>

          <div className="quiz-preview">
            <div className="quiz-header">
              <h2>{formData.title || previewQuiz.title}</h2>
              <p className="quiz-description">{formData.description || previewQuiz.description}</p>
              <div className="quiz-meta">
                <span>{previewQuiz.questions.length} questions</span>
                {formData.duration && <span> • {formData.duration} minutes</span>}
              </div>
            </div>
            
            <div className="questions-list">
              {previewQuiz.questions.map((q, qIndex) => (
                <div key={qIndex} className="question-card">
                  <div className="question-header">
                    <span className="question-number">Question {qIndex + 1}</span>
                    <span className="question-points">
                      {q.marks || q.points || 1} point{(q.marks || q.points || 1) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="question-text">{q.questionText || q.question}</p>
                  
<div className="options-grid">
  {(q.options || []).map((option, oIndex) => {
    // Handle both formats: string or { label, text }
    const optLabel = option.label || String.fromCharCode(65 + oIndex);
    const optText = typeof option === 'string' ? option : option.text || '';
    const correctLabel = typeof q.correctAnswer === 'string' ? q.correctAnswer : String.fromCharCode(65 + q.correctAnswer);

    return (
      <div
        key={oIndex}
        className={`option ${correctLabel === optLabel ? 'correct' : ''}`}
      >
        <span className="option-letter">{optLabel}.</span>
        <span className="option-text">{optText}</span>
        {correctLabel === optLabel && (
          <span className="correct-badge">Correct Answer</span>
        )}
      </div>
    );
  })}
</div>

                  
                  {q.explanation && (
                    <div className="explanation">
                      <strong>Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          <strong>Success:</strong> {success}
        </div>
      )}
    </div>
  );
};

export default AIGenerateQuiz;