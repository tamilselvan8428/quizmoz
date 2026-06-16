import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNo: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'STAFF', 'STUDENT'], required: true },
  department: { type: String },
  section: { type: String },
  batch: { type: String },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
