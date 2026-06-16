import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  rollNo: { type: String, required: true },
  department: { type: String },
  section: { type: String },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  answers: [{ type: Number }],
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const Result = mongoose.model('Result', resultSchema);
