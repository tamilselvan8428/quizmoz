import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true },
  image: { type: String }, // Base64 or URL
});

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  topic: { type: String },
  questions: [questionSchema],
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  duration: { type: Number, required: true }, // in minutes
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department: { type: String },
}, { timestamps: true });

export const Quiz = mongoose.model('Quiz', quizSchema);
