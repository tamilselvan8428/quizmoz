const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const mongoose = require('mongoose');

// Create new quiz
const createQuiz = async (req, res) => {
    try {
        const { title, description, questions, startTime, endTime, duration, department, batch } = req.body;
        
        const quiz = new Quiz({
            title,
            description,
            questions: JSON.parse(questions),
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            duration: Number(duration),
            createdBy: req.user._id,
            department: department || req.user.department,
            batch: batch || req.user.batch
        });

        await quiz.save();
        res.status(201).json({
            success: true,
            message: 'Quiz created successfully',
            quiz
        });
    } catch (error) {
        console.error('Error creating quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create quiz',
            error: error.message
        });
    }
};

// Get all quizzes for staff
const getAllQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ createdBy: req.user._id })
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            quizzes
        });
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch quizzes',
            error: error.message
        });
    }
};

// Get quiz by ID
const getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
            .populate('createdBy', 'name');

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        res.json({
            success: true,
            quiz
        });
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch quiz',
            error: error.message
        });
    }
};

// Update quiz
const updateQuiz = async (req, res) => {
    try {
        const { title, description, questions, startTime, endTime, duration, department, batch } = req.body;
        const quizId = req.params.id;
        
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ 
                success: false, 
                message: 'Quiz not found' 
            });
        }

        // Check permissions
        if (req.user.role !== 'admin' && quiz.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized to edit this quiz' 
            });
        }

        // Update fields
        if (title) quiz.title = title;
        if (description) quiz.description = description;
        if (questions) {
            const parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;
            quiz.questions = parsedQuestions;
        }
        if (startTime) quiz.startTime = new Date(startTime);
        if (endTime) quiz.endTime = new Date(endTime);
        if (duration) quiz.duration = Number(duration);
        if (department) quiz.department = department;
        if (batch) quiz.batch = batch;

        await quiz.save();

        res.json({ 
            success: true, 
            message: 'Quiz updated successfully', 
            quiz 
        });
    } catch (error) {
        console.error('Error updating quiz:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update quiz', 
            error: error.message 
        });
    }
};

// Publish/unpublish quiz
const publishQuiz = async (req, res) => {
    try {
        const { status } = req.body; // 'published' or 'draft'
        const quizId = req.params.id;
        
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ 
                success: false, 
                message: 'Quiz not found' 
            });
        }

        // Check permissions
        if (req.user.role !== 'admin' && quiz.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized to publish this quiz' 
            });
        }

        quiz.status = status || 'published';
        quiz.isVisible = status === 'published';

        await quiz.save();

        res.json({ 
            success: true, 
            message: `Quiz ${status === 'published' ? 'published' : 'unpublished'} successfully`, 
            quiz 
        });
    } catch (error) {
        console.error('Error publishing quiz:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to publish quiz', 
            error: error.message 
        });
    }
};

// Get available quizzes for students
const getAvailableQuizzes = async (req, res) => {
    try {
        const now = new Date();
        
        const quizzes = await Quiz.find({
            status: 'published',
            isVisible: true
        }).populate('createdBy', 'name');

        const results = await QuizResult.find({ user: req.user._id });
        const takenQuizIds = results.map(r => r.quiz.toString());
        
        const availableQuizzes = quizzes.filter(q => 
            !takenQuizIds.includes(q._id.toString())
        );

        res.json({ 
            success: true,
            quizzes: availableQuizzes,
            serverTime: now
        });
    } catch (error) {
        console.error('Error fetching available quizzes:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch available quizzes',
            error: error.message 
        });
    }
};

// Delete quiz
const deleteQuiz = async (req, res) => {
    try {
        const quizId = req.params.id;
        
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ 
                success: false, 
                message: 'Quiz not found' 
            });
        }

        // Check permissions
        if (req.user.role !== 'admin' && quiz.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized to delete this quiz' 
            });
        }

        await Quiz.findByIdAndDelete(quizId);

        res.json({ 
            success: true, 
            message: 'Quiz deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting quiz:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete quiz', 
            error: error.message 
        });
    }
};

module.exports = {
    createQuiz,
    getAllQuizzes,
    getQuizById,
    updateQuiz,
    publishQuiz,
    getAvailableQuizzes,
    deleteQuiz
};
