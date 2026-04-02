const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    questions: [{
        questionText: { type: String, required: true },
        image: {
            data: { type: Buffer },
            contentType: { type: String }
        },
        options: { type: [String], required: true },
        correctAnswer: { type: Number, required: true },
        points: { type: Number, default: 1 }
    }],
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    duration: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: String },
    batch: { type: String },
    status: { type: String, default: 'draft', enum: ['draft', 'published'] },
    isVisible: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quiz', QuizSchema);
