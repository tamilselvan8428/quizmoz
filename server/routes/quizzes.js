const express = require('express');
const router = express.Router();
const { 
    createQuiz, 
    getAllQuizzes, 
    getQuizById, 
    updateQuiz, 
    publishQuiz, 
    getAvailableQuizzes, 
    deleteQuiz 
} = require('../controllers/quizController');

// Create new quiz
router.post('/', async (req, res) => {
    const result = await createQuiz(req, res);
    return result;
});

// Get all quizzes (staff)
router.get('/', async (req, res) => {
    const result = await getAllQuizzes(req, res);
    return result;
});

// Get quiz by ID
router.get('/:id', async (req, res) => {
    const result = await getQuizById(req, res);
    return result;
});

// Update quiz
router.put('/:id', async (req, res) => {
    const result = await updateQuiz(req, res);
    return result;
});

// Publish/unpublish quiz
router.put('/:id/publish', async (req, res) => {
    const result = await publishQuiz(req, res);
    return result;
});

// Get available quizzes for students
router.get('/available', async (req, res) => {
    const result = await getAvailableQuizzes(req, res);
    return result;
});

// Delete quiz
router.delete('/:id', async (req, res) => {
    const result = await deleteQuiz(req, res);
    return result;
});

module.exports = router;
