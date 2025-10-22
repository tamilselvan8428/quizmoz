import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/quiz.css';

const Quiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const answersRef = useRef([]); // keep latest answers synchronously
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(null);
  const timerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false);
  const visibilityChangeRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const [imageLoadError, setImageLoadError] = useState({});
  const [imageUrls, setImageUrls] = useState({});
  
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050';

  const handleVisibilityChange = () => {
    console.debug('[Quiz] visibilitychange fired. hidden=', document.hidden, 'state=', document.visibilityState);
    if (document.hidden) {
      // persist answers immediately on tab hide
      try {
        localStorage.setItem(`quizAnswers_${id}`, JSON.stringify(answersRef.current || []));
      } catch {}

      // Use functional state update to avoid stale closures and ensure correct increments
      setTabSwitchCount(prev => {
        const next = prev + 1;
        if (next === 1) {
          setShowTabSwitchWarning(true);
          setTimeout(() => setShowTabSwitchWarning(false), 3000);
        } else if (next >= 2) {
          submitQuiz(true); // auto-submit immediately on second switch
        }
        return next;
      });
    }
  };

  // Fallback: some browsers/devices may not reliably trigger visibilitychange; use window blur as signal
  const handleWindowBlur = () => {
    console.debug('[Quiz] window blur fired. hasFocus=', document.hasFocus());
    // Treat as potential tab/app switch only if not focused
    // Avoid double counting if visibilitychange already handled this event
    if (document.visibilityState === 'hidden') return;
    if (!document.hasFocus()) {
      try {
        localStorage.setItem(`quizAnswers_${id}`, JSON.stringify(answersRef.current || []));
      } catch {}
      // Functional update to ensure latest count in this event listener
      setTabSwitchCount(prev => {
        const next = prev + 1;
        if (next === 1) {
          setShowTabSwitchWarning(true);
          setTimeout(() => setShowTabSwitchWarning(false), 3000);
        } else if (next >= 2) {
          submitQuiz(true);
        }
        return next;
      });
    }
  };

  useEffect(() => {
    visibilityChangeRef.current = () => handleVisibilityChange();
    const visEvent = 'visibilitychange';
    document.addEventListener(visEvent, visibilityChangeRef.current);
    window.addEventListener('blur', handleWindowBlur);

    // Save answers when the page is being hidden or unloaded (no auto-submit here)
    const handlePageHide = () => {
      console.debug('[Quiz] pagehide fired');
      try {
        localStorage.setItem(`quizAnswers_${id}`, JSON.stringify(answersRef.current || []));
      } catch {}
    };
    const handleBeforeUnload = (e) => {
      console.debug('[Quiz] beforeunload fired');
      try {
        localStorage.setItem(`quizAnswers_${id}`, JSON.stringify(answersRef.current || []));
      } catch {}
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (visibilityChangeRef.current) {
        document.removeEventListener(visEvent, visibilityChangeRef.current);
      }
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        setError('');
        
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await axios.get(`${baseURL}/api/quizzes/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.data?.quiz) {
          throw new Error('Invalid quiz data received');
        }

        const quizData = response.data.quiz;
        
        // Process images to create URLs
        const newImageUrls = {};
        quizData.questions.forEach((question, index) => {
          if (question.image && question.image.data) {
            // Check if data is already a base64 string or a buffer
            if (typeof question.image.data === 'string') {
              // If it's already a base64 string
              newImageUrls[index] = `data:${question.image.contentType};base64,${question.image.data}`;
            } else if (question.image.data.data) {
              // If it's a Buffer object
              const buffer = question.image.data.data || question.image.data;
              const base64String = btoa(
                new Uint8Array(buffer).reduce(
                  (data, byte) => data + String.fromCharCode(byte),
                  ''
                )
              );
              newImageUrls[index] = `data:${question.image.contentType};base64,${base64String}`;
            }
          }
        });
        setImageUrls(newImageUrls);

        if (quizData.endTime) {
          const endTime = new Date(quizData.endTime).getTime();
          const now = new Date().getTime();
          const remaining = Math.max(0, endTime - now);
          setTimeRemaining(remaining);
          
          if (remaining > 0) {
            // Clear any existing interval before starting a new one
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            const timerId = setInterval(() => {
              setTimeRemaining(prev => {
                if (prev <= 1000) {
                  clearInterval(timerId);
                  timerRef.current = null;
                  submitQuiz();
                  return 0;
                }
                return prev - 1000;
              });
            }, 1000);
            timerRef.current = timerId;
          }
        }

        setQuiz(quizData);
        // restore answers from localStorage if present
        let initialAnswers = new Array(quizData.questions.length).fill(null);
        try {
          const saved = localStorage.getItem(`quizAnswers_${id}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              initialAnswers = initialAnswers.map((v, idx) => (typeof parsed[idx] === 'number' ? parsed[idx] : v));
            }
          }
        } catch {}
        setAnswers(initialAnswers);
        answersRef.current = initialAnswers;
        enterFullscreen();
      } catch (err) {
        console.error('Error fetching quiz:', err);
        
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          setError('Session expired. Please login again.');
        } else if (err.response?.status === 404) {
          setError('Quiz not found');
        } else {
          setError(err.response?.data?.message || err.message || 'Failed to load quiz');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      exitFullscreen();
    };
  }, [id, navigate]); 

  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };

  const enterFullscreen = () => {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    }
    setIsFullscreen(true);
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
    setIsFullscreen(false);
  };

  const submitQuiz = async (immediate = false) => {
    try {
      if (isSubmittingRef.current) return; // prevent double submit
      isSubmittingRef.current = true;
      setLoading(true);
      const token = localStorage.getItem('token');
      // persist latest answers
      try {
        localStorage.setItem(`quizAnswers_${id}`, JSON.stringify(answersRef.current || []));
      } catch {}

      const response = await axios.post(`${baseURL}/api/results`, {
        quizId: id,
        answers: answersRef.current
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const totalPoints = (quiz && Array.isArray(quiz.questions))
        ? quiz.questions.reduce((total, q) => total + (q?.points || 1), 0)
        : (Array.isArray(answersRef.current) ? answersRef.current.length : 0);

      setSubmittedResult({
        score: response.data.result?.score || 0,
        total: totalPoints
      });
      
      if (visibilityChangeRef.current) {
        const eventName = document.addEventListener 
          ? 'visibilitychange' 
          : 'webkitvisibilitychange';
        document.removeEventListener(eventName, visibilityChangeRef.current);
      }

      if (immediate) {
        // Auto-submit due to tab switch: show score briefly, then exit
        setTimeout(() => {
          navigate('/');
          exitFullscreen();
        }, 3000);
      } else {
        setTimeout(() => {
          navigate('/');
          exitFullscreen();
        }, 5000);
      }
    } catch (err) {
      console.error('Error submitting quiz:', err);
      setError(err.response?.data?.message || err.message || 'Failed to submit quiz');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleOptionSelect = (questionIndex, optionIndex) => {
    const newAnswers = [...(answersRef.current?.length ? answersRef.current : answers)];
    newAnswers[questionIndex] = optionIndex;
    answersRef.current = newAnswers; // update ref first
    setAnswers(newAnswers);
    try {
      localStorage.setItem(`quizAnswers_${id}`, JSON.stringify(newAnswers));
    } catch {}

    // No deferred auto-submit; score will be based on answered questions
  };

  const formatTime = (milliseconds) => {
    if (!milliseconds) return null;
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading && !submittedResult) {
    return (
      <div className="quiz-loading">
        <div className="spinner"></div>
        <p>Loading quiz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="quiz-not-found">
        <h2>Quiz Not Found</h2>
        <p>The requested quiz could not be loaded.</p>
      </div>
    );
  }

  if (submittedResult) {
    return (
      <div className="quiz-result-container">
        <div className="quiz-result-card">
          <h1>Quiz Submitted Successfully!</h1>
          <div className="score-display">
            Your Score: <span className="score-value">{submittedResult.score}</span>
          </div>
          <div className="max-score">
            Out of: {submittedResult.total}
          </div>
          <p className="redirect-message">You will be redirected to the home page shortly...</p>
        </div>
      </div>
    );
  }

  const currentQuestionData = quiz.questions[currentQuestion];

  return (
    <div className={`quiz-container ${isFullscreen ? 'fullscreen-active' : ''}`}>
      {showTabSwitchWarning && (
        <div className="tab-switch-warning">
          <p>⚠️ Warning: You switched tabs. Please stay on this page during the quiz.</p>
          <p>Next tab switch will automatically submit your quiz.</p>
        </div>
      )}
      
      <div className="quiz-header">
        <h1>{quiz.title}</h1>
        {timeRemaining !== null && (
          <div className="quiz-timer">
            Time Remaining: {formatTime(timeRemaining)}
            {timeRemaining <= 60000 && (
              <span className="time-warning"> (Hurry!)</span>
            )}
          </div>
        )}
      </div>

      <div className="quiz-progress">
        Question {currentQuestion + 1} of {quiz.questions.length}
      </div>

      <div className="question-container">
        <h2 className="question-text">{currentQuestionData.questionText}</h2>

        {imageUrls[currentQuestion] && !imageLoadError[currentQuestion] && (
          <div className="question-image-container">
            <img 
              src={imageUrls[currentQuestion]}
              alt="Question illustration"
              className="question-image"
              onLoad={() => setImageLoadError(prev => ({ ...prev, [currentQuestion]: false }))}
              onError={() => setImageLoadError(prev => ({ ...prev, [currentQuestion]: true }))}
            />
          </div>
        )}
        
        {imageLoadError[currentQuestion] && (
          <div className="image-error">
            Image could not be loaded
          </div>
        )}

        <ul className="options-list">
          {currentQuestionData.options.map((option, index) => (
            <li 
              key={index} 
              className={`option ${answers[currentQuestion] === index ? 'selected' : ''}`}
            >
              <input
                type="radio"
                id={`option-${currentQuestion}-${index}`}
                name={`question-${currentQuestion}`}
                checked={answers[currentQuestion] === index}
                onChange={() => handleOptionSelect(currentQuestion, index)}
              />
              <label htmlFor={`option-${currentQuestion}-${index}`}>
                {option}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="quiz-navigation">
        <button
          onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
          disabled={currentQuestion === 0}
          className="nav-button prev-button"
        >
          Previous
        </button>
        
        {currentQuestion === quiz.questions.length - 1 ? (
          <button
            onClick={submitQuiz}
            disabled={loading}
            className="nav-button submit-button"
          >
            {loading ? 'Submitting...' : 'Submit Quiz'}
          </button>
        ) : (
          <button
            onClick={() => setCurrentQuestion(prev => Math.min(quiz.questions.length - 1, prev + 1))}
            className="nav-button next-button"
          >
            Next
          </button>
        )}
      </div>

      {error && (
        <div className="quiz-error-message">
          {error}
        </div>
      )}

      {!isFullscreen && (
        <div className="fullscreen-prompt">
          <p>Please enter fullscreen mode for the best quiz experience</p>
          <button onClick={enterFullscreen}>Enter Fullscreen</button>
        </div>
      )}
    </div>
  );
};

export default Quiz;