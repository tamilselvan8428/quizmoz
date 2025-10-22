import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaCheck, FaTimes, FaArrowLeft, FaArrowRight, FaArrowAltCircleLeft, FaArrowAltCircleRight } from 'react-icons/fa';
import '../styles/quiz-result.css';

const QuizResultDetails = ({ user }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageCache, setImageCache] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const { id } = useParams();
  const navigate = useNavigate();

  // Function to get image URL
  const getImageUrl = (question, index) => {
    if (!question) return null;
    
    // Check cache first
    const cacheKey = `${id}-q${index}`;
    if (imageCache[cacheKey]) {
      console.log('Returning from cache:', cacheKey);
      return imageCache[cacheKey];
    }
    
    // Check for image URL (used in results)
    if (question.imageUrl) {
      // If it's already a full URL or data URL, cache and return it
      if (typeof question.imageUrl === 'string' && 
          (question.imageUrl.startsWith('http') || 
           question.imageUrl.startsWith('data:') ||
           question.imageUrl.startsWith('blob:'))) {
        setImageCache(prev => ({ ...prev, [cacheKey]: question.imageUrl }));
        return question.imageUrl;
      }
      
      // If it's a base64 string without prefix, add the data URL prefix
      if (typeof question.imageUrl === 'string') {
        const dataUrl = `data:image/png;base64,${question.imageUrl}`;
        setImageCache(prev => ({ ...prev, [cacheKey]: dataUrl }));
        return dataUrl;
      }
    }
    
    // Check for image data if available
    if (question.image) {
      // If it's a Buffer object
      if (question.image.data) {
        try {
          const buffer = question.image.data.data || question.image.data;
          const bytes = buffer instanceof Uint8Array 
            ? buffer 
            : new Uint8Array(buffer);
          
          const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
          const base64String = btoa(binary);
          const dataUrl = `data:${question.image.contentType || 'image/png'};base64,${base64String}`;
          
          setImageCache(prev => ({ ...prev, [cacheKey]: dataUrl }));
          return dataUrl;
        } catch (err) {
          console.error('Error processing image buffer:', err);
        }
      }
      
      // If it's a direct URL string
      if (typeof question.image === 'string') {
        setImageCache(prev => ({ ...prev, [cacheKey]: question.image }));
        return question.image;
      }
    }
    
    return null;
  };

  useEffect(() => {
    const fetchResultDetails = async () => {
      try {
        const res = await axios.get(`/api/results/${id}/details`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (res.data.success) {
          // Process the result data
          const processedResult = { ...res.data.result };
          
          // Cache any image data
          const newImageCache = { ...imageCache };
          if (processedResult.quiz?.questions) {
            processedResult.quiz.questions.forEach((q, idx) => {
              const cacheKey = `${id}-q${idx}`;
              if (q.imageUrl && !newImageCache[cacheKey]) {
                newImageCache[cacheKey] = getImageUrl(q, idx);
              }
            });
          }
          
          setImageCache(newImageCache);
          setResult(processedResult);
        } else {
          setError(res.data.message || 'Failed to load result details');
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch result details');
        if (err.response?.status === 401) {
          navigate('/login');
        } else if (err.response?.status === 403) {
          navigate('/student');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchResultDetails();
  }, [id, navigate, imageCache]);

  // Calculate total points and score percentage
  const totalPoints = result?.quiz?.questions?.reduce(
    (sum, q) => sum + (q.points || 1), 0
  ) || 0;
  const scorePercentage = totalPoints > 0 
    ? Math.round((result?.score / totalPoints) * 100) 
    : 0;

  const handleNextQuestion = () => {
    if (currentQuestion < result?.quiz?.questions?.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading quiz results...</p>
    </div>
  );
  
  if (error) return (
    <div className="error-container">
      <div className="error-icon">!</div>
      <h2>Error Loading Results</h2>
      <p>{error}</p>
      <button onClick={() => navigate('/student')} className="back-button">
        <FaArrowLeft /> Back to Dashboard
      </button>
    </div>
  );
  
  if (!result) return (
    <div className="error-container">
      <h2>No Result Data Available</h2>
      <button onClick={() => navigate('/student')} className="back-button">
        <FaArrowLeft /> Back to Dashboard
      </button>
    </div>
  );

  return (
    <div className="quiz-result-app">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="quiz-title-nav">
            <span>Results: {result.quiz.title}</span>
          </div>
          <div className="nav-actions">
            <div className="user-profile">
              <span className="user-name">{user.name}</span>
              <img 
                src={user.avatar || '/default-avatar.png'} 
                alt="User" 
                className="user-avatar" 
              />
            </div>
            <button 
              onClick={() => navigate('/student')} 
              className="nav-button"
            >
              <FaArrowLeft /> Dashboard
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="quiz-result-content">
        {/* Summary Section */}
        <section className="quiz-summary-section">
          <div className="summary-card">
            <h2>Quiz Summary</h2>
            <div className="summary-grid">
              <div className="summary-item">
                <div className="summary-icon score-icon">
                  <FaCheck />
                </div>
                <div className="summary-text">
                  <span className="summary-label">Score</span>
                  <span className="summary-value">{result.score}/{totalPoints}</span>
                </div>
              </div>
              
              <div className="summary-item">
                <div className="summary-icon percentage-icon">
                  %
                </div>
                <div className="summary-text">
                  <span className="summary-label">Percentage</span>
                  <span className="summary-value">{scorePercentage}%</span>
                </div>
              </div>
              
              <div className="summary-item">
                <div className="summary-icon questions-icon">
                  ?
                </div>
                <div className="summary-text">
                  <span className="summary-label">Questions</span>
                  <span className="summary-value">{result.quiz.questions.length}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Questions Section */}
        <section className="questions-section">
          <div className="question-navigation">
            <button 
              onClick={handlePrevQuestion} 
              className="nav-button"
              disabled={currentQuestion === 0}
            >
              <FaArrowAltCircleLeft /> Previous
            </button>
            
            <div className="question-counter">
              Question {currentQuestion + 1} of {result.quiz.questions.length}
            </div>
            
            <button 
              onClick={handleNextQuestion} 
              className="nav-button"
              disabled={currentQuestion === result.quiz.questions.length - 1}
            >
              Next <FaArrowAltCircleRight />
            </button>
          </div>

          {/* Current Question */}
          {result.quiz.questions.map((question, index) => {
            if (index !== currentQuestion) return null;
            
            const isCorrect = result.answers[index] === question.correctAnswer;
            const cacheKey = `${id}-q${index}`;
            const imageSrc = question.imageUrl || imageCache[cacheKey];
            
            return (
              <div 
                key={index} 
                className={`question-card ${isCorrect ? 'correct' : 'incorrect'}`}
              >
                <div className="question-header">
                  <div className="question-meta">
                    <span className="question-number">Question {index + 1}</span>
                    <span className="question-points">
                      {question.points || 1} {question.points === 1 ? 'point' : 'points'}
                    </span>
                  </div>
                  <div className={`question-status ${isCorrect ? 'correct' : 'incorrect'}`}>
                    {isCorrect ? (
                      <>
                        <FaCheck className="status-icon" /> Correct
                      </>
                    ) : (
                      <>
                        <FaTimes className="status-icon" /> Incorrect
                      </>
                    )}
                  </div>
                </div>
                
                <div className="question-content">
                  <p className="question-text">{question.questionText}</p>
                  {(() => {
                    const imageUrl = getImageUrl(question, currentQuestion);
                    
                    return imageUrl ? (
                      <div className="question-image-container">
                        <img 
                          src={imageUrl}
                          alt="Question" 
                          className="question-image"
                          onError={(e) => {
                            console.error('Error loading image:', e);
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null;
                  })()}
                  
                  <div className="options">
                    {question.options.map((option, optIndex) => {
                      const isCorrectAnswer = optIndex === question.correctAnswer;
                      const isUserAnswer = optIndex === result.answers[index];
                      
                      return (
                        <div 
                          key={optIndex}
                          className={`option ${isCorrectAnswer ? 'correct-answer' : ''} ${isUserAnswer ? 'your-answer' : ''}`}
                        >
                          <span className="option-letter">
                            {String.fromCharCode(65 + optIndex)}.
                          </span>
                          <span className="option-text">{option}</span>
                          {isCorrectAnswer && (
                            <span className="correct-indicator">
                              <FaCheck />
                            </span>
                          )}
                          {isUserAnswer && !isCorrectAnswer && (
                            <span className="incorrect-indicator">
                              <FaTimes />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {!isCorrect && (
                    <div className="feedback">
                      <div className="correct-answer-container">
                        <div className="correct-answer-text">
                          <div className="correct-answer-header">
                            <span className="correct-answer-label">Correct answer:</span>
                            <span className="correct-answer-option">
                              {String.fromCharCode(65 + question.correctAnswer)}. {question.options[question.correctAnswer]}
                            </span>
                          </div>
                          
                          {/* Enhanced question image display with correct answer */}
                          {(() => {
                            const imageUrl = getImageUrl(question, index);
                            if (!imageUrl) return null;
                            
                            return (
                              <div className="correct-answer-image-container">
                                <img 
                                  src={imageUrl}
                                  alt="Question for correct answer" 
                                  className="correct-answer-image"
                                  onError={(e) => {
                                    console.error('Error loading feedback image:', e);
                                    e.target.style.display = 'none';
                                  }}
                                />
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      
                      {question.explanation && (
                        <div className="explanation">
                          <div className="explanation-header">
                            <span className="explanation-icon">💡</span>
                            <strong>Explanation</strong>
                          </div>
                          <p className="explanation-text">{question.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
};

export default QuizResultDetails;