import mongoose from 'mongoose';

const studyMaterialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  topic: { type: String },
  fileContent: { type: String }, // Base64 content of file
  fileName: { type: String },
  fileType: { type: String },
  fileSize: { type: Number },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploaderName: { type: String, required: true },
  department: { type: String },
  folderName: { type: String },
  folderId: { type: String },
}, { timestamps: true });

export const StudyMaterial = mongoose.model('StudyMaterial', studyMaterialSchema);
