const QuizResult = require('../models/QuizResult');
const Quiz = require('../models/Quiz');
const User = require('../models/User');

// Submit quiz answers
const submitQuiz = async (req, res) => {
    try {
        const { quizId, answers } = req.body;
        const userId = req.user._id;

        // Get quiz to calculate score
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Calculate score
        let score = 0;
        quiz.questions.forEach((question, index) => {
            const userAnswer = answers[index];
            if (userAnswer === question.correctAnswer) {
                score += question.points || 1;
            }
        });

        // Save quiz result
        const quizResult = new QuizResult({
            quiz: quizId,
            user: userId,
            answers,
            score
        });

        await quizResult.save();

        res.json({
            success: true,
            message: 'Quiz submitted successfully',
            score,
            totalQuestions: quiz.questions.length,
            correctAnswers: answers.filter((answer, index) => 
                answer === quiz.questions[index].correctAnswer
            ).length
        });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit quiz',
            error: error.message
        });
    }
};

// Get quiz results for staff
const getQuizResults = async (req, res) => {
    try {
        const { quizId } = req.params;
        
        const results = await QuizResult.find({ quiz: quizId })
            .populate('user', 'name rollNumber')
            .sort({ submittedAt: -1 });

        res.json({
            success: true,
            results
        });
    } catch (error) {
        console.error('Error fetching quiz results:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch quiz results',
            error: error.message
        });
    }
};

// Get student results
const getStudentResults = async (req, res) => {
    try {
        const userId = req.user._id;
        
        const results = await QuizResult.find({ user: userId })
            .populate('quiz', 'title')
            .sort({ submittedAt: -1 });

        res.json({
            success: true,
            results
        });
    } catch (error) {
        console.error('Error fetching student results:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch student results',
            error: error.message
        });
    }
};

// Export quiz results to Excel
const exportQuizResults = async (req, res) => {
    try {
        const { quizId } = req.params;
        
        const results = await QuizResult.find({ quiz: quizId })
            .populate('user', 'name rollNumber')
            .sort({ submittedAt: -1 });

        // Create Excel data
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Quiz Results');

        // Add headers
        worksheet.columns = [
            { header: 'Student Name', key: 'userName', width: 20 },
            { header: 'Roll Number', key: 'rollNumber', width: 15 },
            { header: 'Score', key: 'score', width: 10 },
            { header: 'Submitted At', key: 'submittedAt', width: 20 }
        ];

        // Add data
        const data = results.map(result => ({
            userName: result.user.name,
            rollNumber: result.user.rollNumber,
            score: result.score,
            submittedAt: new Date(result.submittedAt).toLocaleString()
        }));

        worksheet.addRows(data);

        // Set headers and send
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=quiz_results_${quizId}.xlsx`);

        await workbook.xlsx.write(res);
    } catch (error) {
        console.error('Error exporting results:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export results',
            error: error.message
        });
    }
};

module.exports = {
    submitQuiz,
    getQuizResults,
    getStudentResults,
    exportQuizResults
};
