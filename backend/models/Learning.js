import mongoose from 'mongoose';

const learningSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  topic: { type: String, required: true },
  messages: [{
    role: { type: String, enum: ['user', 'model'], required: true },
    text: { type: String, required: true }
  }],
  createdAt: { type: Date, default: Date.now },
  lastUpdatedAt: { type: Date, default: Date.now }
});

export const Learning = mongoose.model('Learning', learningSchema);
