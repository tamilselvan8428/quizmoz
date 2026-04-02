const express = require('express');
const router = express.Router();
const { 
    submitQuiz, 
    getQuizResults, 
    getStudentResults, 
    exportQuizResults 
} = require('../controllers/quizResultController');

// Submit quiz
router.post('/:quizId/submit', async (req, res) => {
    const result = await submitQuiz(req, res);
    return result;
});

// Get quiz results (staff)
router.get('/:quizId/results', async (req, res) => {
    const result = await getQuizResults(req, res);
    return result;
});

// Get student results
router.get('/', async (req, res) => {
    const result = await getStudentResults(req, res);
    return result;
});

// Export quiz results
router.get('/:quizId/results/export', async (req, res) => {
    const result = await exportQuizResults(req, res);
    return result;
});

module.exports = router;
