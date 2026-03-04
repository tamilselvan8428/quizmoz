// Load environment variables first
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Debug environment variables
console.log('Environment Variables:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('- PORT:', process.env.PORT);
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set (starts with ' + process.env.OPENAI_API_KEY.substring(0, 5) + '...)' : 'Not set');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const multer = require('multer');

const app = express();

// Enhanced CORS configuration
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Add OPTIONS handler
app.options('*', cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection with enhanced logging

// Function to update existing quizzes with missing fields
async function updateQuizFields() {
  try {
    console.log('Updating quiz fields...');
    
    // Update existing quizzes to add missing fields
    const result = await mongoose.connection.db.collection('quizzes').updateMany(
      {},
      {
        $set: {
          status: 'draft',
          isVisible: false
        }
      },
      { upsert: false }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`Updated ${result.modifiedCount} quizzes with status and isVisible fields`);
    }
  } catch (error) {
    console.error('Error updating quiz fields:', error);
  }
}

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
})
.then(async () => {
    console.log('Connected to MongoDB');
    await rebuildIndexes();
    await createDefaultAdmin();
    await updateQuizFields();
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    console.warn('Continuing to start server without MongoDB. Some routes will not work until DB is connected.');
});

// Connection event listeners
mongoose.connection.on('connected', () => console.log('MongoDB connected'));
mongoose.connection.on('disconnected', () => console.log('MongoDB disconnected'));
mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));

// Configure storage for uploaded images
const storage = multer.diskStorage({
destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
},
filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
}
});

const upload = multer({ 
storage: storage,
limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
    return cb(null, true);
    } else {
    cb(new Error('Error: Images only!'));
    }
}
});

// Separate memory storage for document uploads (PDF/DOCX/TXT) for AI quiz generation
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowed.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Error: Only PDF, DOCX, or TXT files are allowed'));
  }
});

// Serve static files
app.use('/uploads', express.static('uploads'));
// Models
const UserSchema = new mongoose.Schema({
    name: String,
    rollNumber: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ['student', 'staff', 'admin'], default: 'student' },
    department: String,
    section: String,
    batch: String,
    isApproved: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

// Add query helper to exclude deleted users by default
UserSchema.pre('find', function() {
    this.where({ isDeleted: { $ne: true } });
});

UserSchema.pre('findOne', function() {
    this.where({ isDeleted: { $ne: true } });
});

// Static method to include deleted users when needed
UserSchema.statics.findIncludingDeleted = function(conditions = {}) {
    return this.find({ ...conditions });
};

// Static method to find by roll number including deleted users
UserSchema.statics.findByRollNumberIncludingDeleted = function(rollNumber) {
    return this.findOne({ rollNumber });
};

const DeletedUserSchema = new mongoose.Schema({
    // original data snapshot
    originalUserId: { type: mongoose.Schema.Types.ObjectId, index: true },
    name: String,
    rollNumber: String,
    password: String, // preserve hash so login works after restore
    role: String,
    department: String,
    section: String,
    batch: String,
    isApproved: { type: Boolean, default: false },
    createdAt: { type: Date },
    // audit
    deletedAt: { type: Date, default: Date.now }
});

const QuizSchema = new mongoose.Schema({
title: String,
description: String,
questions: [{
questionText: String,
image: {
  data: Buffer,
  contentType: String
},
options: [String],
correctAnswer: Number,
points: Number
}],
startTime: Date,
endTime: Date,
duration: Number,
createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
department: String,
batch: String,
status: { type: String, default: 'draft', enum: ['draft', 'published'] },
isVisible: { type: Boolean, default: false },
createdAt: { type: Date, default: Date.now }
});

const QuizResultSchema = new mongoose.Schema({
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    answers: [Number],
    score: Number,
    submittedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const DeletedUser = mongoose.model('DeletedUser', DeletedUserSchema);
const Quiz = mongoose.model('Quiz', QuizSchema);
const QuizResult = mongoose.model('QuizResult', QuizResultSchema);

// Index Management
async function rebuildIndexes() {
    try {
        await User.syncIndexes();
        await DeletedUser.syncIndexes();
        await Quiz.syncIndexes();
        await QuizResult.syncIndexes();
        console.log('All indexes rebuilt successfully');
    } catch (err) {
        console.error('Error rebuilding indexes:', err);
    }
}

// Default Admin Creation
async function createDefaultAdmin() {
    try {
        const defaultAdmin = {
            name: "System Administrator",
            rollNumber: "admin",
            password: "admin123",
            role: "admin",
            department: "Administration",
            isApproved: true
        };

        const existingAdmin = await User.findOne({ rollNumber: defaultAdmin.rollNumber });
        if (!existingAdmin) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(defaultAdmin.password, salt);
            
            await User.create({
                ...defaultAdmin,
                password: hashedPassword
            });
            
            console.log('\n=== DEFAULT ADMIN ACCOUNT ===');
            console.log(`Username: ${defaultAdmin.rollNumber}`);
            console.log(`Password: ${defaultAdmin.password}`);
            console.log('============================\n');
        }
    } catch (err) {
        console.error('Error creating default admin:', err);
    }
}

// Authentication Middleware
const authenticate = (req, res, next) => {
    console.log('Authentication Middleware - Request Headers:', JSON.stringify(req.headers, null, 2));
    const authHeader = req.headers.authorization;
    console.log('Auth Header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No Bearer token found in Authorization header');
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
    
    const token = authHeader.split(' ')[1];
    console.log('JWT Token:', token);
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
    
    if (!token) {
        console.log('No token found after Bearer');
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    try {
        console.log('Verifying token...');
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'quizappsecret');
        console.log('Token verified successfully:', verified);
        req.user = verified;
        next();
    } catch (err) {
        console.error('Token verification failed:', {
            name: err.name,
            message: err.message,
            expiredAt: err.expiredAt,
            stack: err.stack
        });
        res.status(400).json({ 
            success: false, 
            message: 'Invalid token: ' + err.message,
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

const authorize = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Forbidden. Insufficient permissions.' 
            });
        }
        next();
    };
};

// Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// User Management Routes
app.get('/api/users/pending', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { role, department, section, batch, search } = req.query;
        
        const query = { isApproved: false };
        
        if (role) query.role = role;
        if (department) query.department = new RegExp(department, 'i');
        if (section) query.section = new RegExp(section, 'i');
        if (batch) query.batch = new RegExp(batch, 'i');
        if (search) {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { rollNumber: new RegExp(search, 'i') }
            ];
        }

        const users = await User.find(query);
        res.json({ success: true, users });
    } catch (err) {
        console.error('Error in /api/users/pending:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching pending users',
            error: err.message 
        });
    }
});

app.get('/api/users', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { role, department, section, batch, search } = req.query;
        
        const query = { isApproved: true };
        
        if (role) query.role = role;
        if (department) query.department = new RegExp(department, 'i');
        if (section) query.section = new RegExp(section, 'i');
        if (batch) query.batch = new RegExp(batch, 'i');
        if (search) {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { rollNumber: new RegExp(search, 'i') }
            ];
        }

        const users = await User.find(query).select('-password');
        res.json({ success: true, users });
    } catch (err) {
        console.error('Error in /api/users:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching active users',
            error: err.message 
        });
    }
});

app.get('/api/deleted-users', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { role, department, section, batch, search } = req.query;
        
        const query = {};
        
        if (role) query.role = role;
        if (department) query.department = new RegExp(department, 'i');
        if (section) query.section = new RegExp(section, 'i');
        if (batch) query.batch = new RegExp(batch, 'i');
        if (search) {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { rollNumber: new RegExp(search, 'i') }
            ];
        }

        const deletedUsers = await DeletedUser.find(query).sort({ deletedAt: -1 });
        res.json({ success: true, deletedUsers });
    } catch (err) {
        console.error('Error in /api/deleted-users:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching deleted users',
            error: err.message 
        });
    }
});

app.post('/api/users/approve', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid user IDs provided' 
            });
        }

        const result = await User.updateMany(
            { _id: { $in: userIds } },
            { $set: { isApproved: true } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'No users found to approve' 
            });
        }

        res.json({ 
            success: true, 
            message: `${result.modifiedCount} user(s) approved successfully` 
        });
    } catch (err) {
        console.error('Error in /api/users/approve:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while approving users',
            error: err.message
        });
    }
});

// Delete a user (archive snapshot + remove). Restorable with original _id.
app.delete('/api/users/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid user ID format' 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Archive snapshot (including password hash) with original _id reference
        const snapshot = new DeletedUser({
            originalUserId: user._id,
            name: user.name,
            rollNumber: user.rollNumber,
            password: user.password,
            role: user.role,
            department: user.department,
            section: user.section,
            batch: user.batch,
            isApproved: !!user.isApproved,
            createdAt: user.createdAt
        });
        await snapshot.save();

        // Remove from active users (free up rollNumber unique index)
        await User.deleteOne({ _id: userId });

        res.json({ 
            success: true, 
            message: 'User deleted successfully',
            deletedUser: {
                id: snapshot._id,
                name: snapshot.name,
                rollNumber: snapshot.rollNumber
            }
        });
    } catch (err) {
        console.error('Error in DELETE /api/users/:id:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while deleting user',
            error: err.message 
        });
    }
});

// Permanently delete a user from deleted users collection
app.delete('/api/users/permanent/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid user ID format' 
            });
        }

        const result = await DeletedUser.findByIdAndDelete(userId);
        
        if (!result) {
            return res.status(404).json({ 
                success: false, 
                message: 'Deleted user record not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'User permanently deleted',
            deletedUser: {
                name: result.name,
                rollNumber: result.rollNumber
            }
        });
    } catch (err) {
        console.error('Error in DELETE /api/users/permanent/:id:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while permanently deleting user',
            error: err.message 
        });
    }
});

// Restore a previously deleted user by snapshot id.
app.post('/api/users/restore/:id', authenticate, authorize(['admin']), async (req, res) => {
    const session = await mongoose.startSession();
    try {
        await session.startTransaction();
        const userId = req.params.id;

        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            await session.abortTransaction();
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid user ID format' 
            });
        }

        // Find the deleted user snapshot
        const deletedUser = await DeletedUser.findById(userId).session(session);
        if (!deletedUser) {
            await session.abortTransaction();
            return res.status(404).json({ 
                success: false, 
                message: 'Deleted user record not found' 
            });
        }

        // Check for any existing active user with same roll number
        const existingUser = await User.findOne({ 
            rollNumber: deletedUser.rollNumber 
        }).session(session);

        if (existingUser) {
            await session.abortTransaction();
            
            const responseData = {
                success: false,
                message: `User with roll number ${deletedUser.rollNumber} already exists`,
                errorType: 'ROLL_NUMBER_CONFLICT',
                conflictDetails: {
                    deletedUserId: deletedUser._id,
                    deletedUserName: deletedUser.name,
                    existingUserId: existingUser._id,
                    existingUserName: existingUser.name,
                    rollNumber: deletedUser.rollNumber,
                    status: 'active'
                }
            };

            return res.status(409).json(responseData);
        }

        // Optionally allow changing roll number when restoring
        const newRollNumber = req.body.newRollNumber;
        if (newRollNumber) {
            // Validate new roll number format if needed
            const userWithNewRoll = await User.findOne({ 
                rollNumber: newRollNumber 
            }).session(session);
            
            if (userWithNewRoll) {
                await session.abortTransaction();
                return res.status(409).json({
                    success: false,
                    message: `The new roll number ${newRollNumber} is already in use`
                });
            }
        }

        // Recreate the user with original _id so all references (e.g., QuizResult.user) remain valid
        const restoredUser = new User({
            _id: deletedUser.originalUserId,
            name: deletedUser.name,
            rollNumber: newRollNumber || deletedUser.rollNumber,
            role: deletedUser.role,
            department: deletedUser.department,
            section: deletedUser.section,
            batch: deletedUser.batch,
            isApproved: !!deletedUser.isApproved,
            password: deletedUser.password,
            createdAt: deletedUser.createdAt
        });

        await restoredUser.save({ session });
        await DeletedUser.findByIdAndDelete(userId).session(session);
        await session.commitTransaction();

        return res.json({ 
            success: true, 
            message: 'User restored successfully',
            user: {
                id: restoredUser._id,
                name: restoredUser.name,
                rollNumber: restoredUser.rollNumber
            }
        });

    } catch (err) {
        await session.abortTransaction();
        console.error('Error during user restoration:', err);
        
        return res.status(500).json({ 
            success: false, 
            message: 'Server error while restoring user',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } finally {
        session.endSession();
    }
});

// New endpoint to find hidden users
app.get('/api/users/search-hidden', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { rollNumber } = req.query;
        
        if (!rollNumber) {
            return res.status(400).json({ 
                success: false, 
                message: 'Roll number is required' 
            });
        }

        const users = await User.find({
            rollNumber: new RegExp(rollNumber, 'i'),
            $or: [
                { isDeleted: true },
                { isApproved: false }
            ]
        }).select('name rollNumber role department isDeleted isApproved');

        res.json({ 
            success: true, 
            users 
        });
    } catch (err) {
        console.error('Error searching hidden users:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to search hidden users',
            error: err.message 
        });
    }
});

// New endpoint to find hidden users
app.get('/api/users/search-hidden', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { rollNumber } = req.query;
        
        if (!rollNumber) {
            return res.status(400).json({ 
                success: false, 
                message: 'Roll number is required' 
            });
        }

        const users = await User.find({
            rollNumber: new RegExp(rollNumber, 'i'),
            $or: [
                { isDeleted: true },
                { isApproved: false }
            ]
        }).select('name rollNumber role department isDeleted isApproved');

        res.json({ 
            success: true, 
            users 
        });
    } catch (err) {
        console.error('Error searching hidden users:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to search hidden users',
            error: err.message 
        });
    }
});
// Auth Routes
app.post('/api/register', async (req, res) => {
    try {
        const { name, rollNumber, password, role, department, section, batch } = req.body;
        
        if (!name || !rollNumber || !password || !department) {
            return res.status(400).json({ 
                success: false,
                message: 'Missing required fields: name, rollNumber, password, department' 
            });
        }

        if (role === 'student' && !batch) {
            return res.status(400).json({
                success: false,
                message: 'Batch is required for students'
            });
        }

        const existingUser = await User.findOne({ rollNumber });
        if (existingUser) {
            return res.status(409).json({ 
                success: false,
                message: 'User already exists with this roll number' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({
            name,
            rollNumber,
            password: hashedPassword,
            role: role || 'student',
            department,
            section,
            batch,
            isApproved: role === 'admin'
        });

        await user.save();
        
        res.status(201).json({ 
            success: true,
            message: 'User registered successfully. ' + 
                    (role === 'admin' ? 'Admin account created.' : 'Waiting for admin approval.'),
            user: {
                id: user._id,
                name: user.name,
                rollNumber: user.rollNumber,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Error in /api/register:', err);
        res.status(500).json({ 
            success: false,
            message: 'Registration failed',
            error: err.message 
        });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { rollNumber, password } = req.body;
        
        if (!rollNumber || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Roll number and password are required' 
            });
        }

        const user = await User.findOne({ rollNumber });
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        if (!user.isApproved) {
            return res.status(403).json({ 
                success: false, 
                message: 'Account pending admin approval' 
            });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        const token = jwt.sign(
            { 
                _id: user._id, 
                role: user.role, 
                name: user.name,
                department: user.department,
                batch: user.batch
            },
            process.env.JWT_SECRET || 'quizappsecret',
            { expiresIn: '1h' }
        );

        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                role: user.role,
                department: user.department,
                section: user.section,
                batch: user.batch
            }
        });
    } catch (err) {
        console.error('Error in /api/login:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Login failed',
            error: err.message 
        });
    }
});

app.get('/api/validate', authenticate, (req, res) => {
    res.json({
        success: true,
        user: {
            _id: req.user._id,
            name: req.user.name,
            role: req.user.role,
            department: req.user.department,
            batch: req.user.batch
        }
    });
});

// Quiz Routes with Image Support
app.post('/api/quizzes', 
authenticate, 
authorize(['staff', 'admin']), 
upload.array('questionImages'), 
async (req, res) => {
try {
  const { title, description, questions, startTime, endTime, duration, department, batch } = req.body;
  
  // Parse questions safely
  let parsedQuestions = [];
  try {
    parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : (Array.isArray(questions) ? questions : []);
  } catch (e) {
    return res.status(400).json({ success: false, message: 'Invalid questions payload. Must be a JSON array.' });
  }
  
  const processedQuestions = await Promise.all(parsedQuestions.map(async (q, index) => {
    // Normalize options to array of strings
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const options = rawOptions.length > 0
      ? rawOptions.map((opt, i) => {
          if (typeof opt === 'string') return opt;
          if (opt && typeof opt === 'object') return opt.text || `Option ${String.fromCharCode(65 + i)}`;
          return `Option ${String.fromCharCode(65 + i)}`;
        })
      : ['Option A', 'Option B', 'Option C', 'Option D'];

    // Normalize correctAnswer to a valid index
    let correctAnswer = 0;
    if (typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < options.length) {
      correctAnswer = q.correctAnswer;
    } else if (typeof q.correctAnswer === 'string') {
      const letter = q.correctAnswer.trim().toUpperCase().replace(/[^A-D]/g, '');
      if (letter >= 'A' && letter <= 'D') {
        correctAnswer = letter.charCodeAt(0) - 65;
      }
    }

    const questionData = {
      questionText: q.questionText,
      options,
      correctAnswer,
      points: Number(q.points) > 0 ? Number(q.points) : 1
    };
    
    if (req.files && req.files[index]) {
      const file = req.files[index];
      questionData.image = {
        data: fs.readFileSync(file.path),
        contentType: file.mimetype
      };
      // Clean up the uploaded file
      fs.unlinkSync(file.path);
    }
    
    return questionData;
  }));

  // Provide sensible defaults for scheduling if not provided
  const now = new Date();
  const defaultStart = now;
  const defaultEnd = new Date(now.getTime() + 30 * 60 * 1000); // +30 minutes
  const start = startTime ? new Date(startTime) : defaultStart;
  const end = endTime ? new Date(endTime) : defaultEnd;
  const dur = Number(duration) > 0 ? Number(duration) : Math.max(1, Math.round((end - start) / (60 * 1000)));

  const quiz = new Quiz({
    title: title || 'Untitled Quiz',
    description: description || '',
    questions: processedQuestions,
    startTime: isNaN(start.getTime()) ? defaultStart : start,
    endTime: isNaN(end.getTime()) ? defaultEnd : end,
    duration: isNaN(dur) ? 30 : dur,
    createdBy: req.user._id,
    department: department || req.user.department || '',
    batch: batch || req.user.batch || ''
  });

  await quiz.save();
  
  res.status(201).json({
    success: true,
    message: 'Quiz created successfully',
    quiz
  });
} catch (err) {
  console.error('Error creating quiz:', err);
  res.status(500).json({
    success: false,
    message: 'Failed to create quiz',
    error: err.message
  });
}
}
);

app.get('/api/quizzes', authenticate, authorize(['staff', 'admin']), async (req, res) => {
try {
    const query = req.user.role === 'admin' 
    ? {} 
    : { createdBy: req.user._id };

    const quizzes = await Quiz.find(query)
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name');

    res.json({ 
    success: true,
    quizzes 
    });
} catch (err) {
    console.error('Error fetching quizzes:', err);
    res.status(500).json({ 
    success: false, 
    message: 'Failed to fetch quizzes',
    error: err.message 
    });
}
});
app.get('/api/quizzes/:quizId/questions/:questionId/image', async (req, res) => {
try {
const quiz = await Quiz.findById(req.params.quizId);
if (!quiz) return res.status(404).send('Quiz not found');

const question = quiz.questions.id(req.params.questionId);
if (!question || !question.image || !question.image.data) {
  return res.status(404).send('Image not found');
}

res.set('Content-Type', question.image.contentType);
res.send(question.image.data);
} catch (err) {
console.error('Error fetching question image:', err);
res.status(500).send('Failed to fetch image');
}
});
app.get('/api/quizzes/available', authenticate, authorize(['student']), async (req, res) => {
try {
    const now = new Date();
    
    const quizzes = await Quiz.find({
    status: 'published',
    isVisible: true,
    startTime: { $lte: now },
    endTime: { $gte: now }
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
} catch (err) {
    console.error('Error fetching available quizzes:', err);
    res.status(500).json({ 
    success: false, 
    message: 'Failed to fetch available quizzes',
    error: err.message 
    });
}
});

// Delete a quiz
app.delete('/api/quizzes/:id', authenticate, authorize(['staff', 'admin']), async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Check if the user is the creator of the quiz or an admin
        if (req.user.role !== 'admin' && quiz.createdBy.toString() !== req.user._id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this quiz'
            });
        }

        await Quiz.findByIdAndDelete(req.params.id);
        
        // Also delete all results associated with this quiz
        await QuizResult.deleteMany({ quiz: req.params.id });

        res.json({
            success: true,
            message: 'Quiz deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting quiz:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to delete quiz',
            error: err.message
        });
    }
});

// Get quiz by ID
app.get('/api/quizzes/:id', authenticate, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id).populate('createdBy', 'name');
        if (!quiz) return res.status(404).json({ 
            success: false, 
            message: 'Quiz not found' 
        });

        if (req.user.role === 'student') {
            const quizForStudent = {
                ...quiz.toObject(),
                questions: quiz.questions.map(q => ({
                    questionText: q.questionText,
                    image: q.image,
                    options: q.options,
                    points: q.points
                }))
            };
            return res.json({ success: true, quiz: quizForStudent });
        }

        res.json({ success: true, quiz });
    } catch (err) {
        console.error('Error fetching quiz:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch quiz',
            error: err.message 
        });
    }
});

// Quiz Results Routes
app.post('/api/results', authenticate, authorize(['student']), async (req, res) => {
    try {
        const { quizId, answers } = req.body;
        const now = new Date();
        
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ 
                success: false, 
                message: 'Quiz not found' 
            });
        }

        if (now < new Date(quiz.startTime)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Quiz has not started yet' 
            });
        }

        if (now > new Date(quiz.endTime)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Quiz has already ended' 
            });
        }

        const existingResult = await QuizResult.findOne({ 
            quiz: quizId, 
            user: req.user._id 
        });
        
        if (existingResult) {
            return res.status(400).json({ 
                success: false, 
                message: 'You have already taken this quiz' 
            });
        }

        let score = 0;
        quiz.questions.forEach((q, i) => {
            if (answers[i] === q.correctAnswer) {
                score += q.points || 1;
            }
        });

        const result = new QuizResult({
            quiz: quizId,
            user: req.user._id,
            answers,
            score
        });

        await result.save();
        res.json({ success: true, result });
    } catch (err) {
        console.error('Error submitting quiz:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to submit quiz',
            error: err.message 
        });
    }
});

app.get('/api/results', authenticate, async (req, res) => {
    try {
        let results;
        if (req.user.role === 'student') {
            results = await QuizResult.find({ user: req.user._id })
                .populate('quiz', 'title');
        } else {
            results = await QuizResult.find({ quiz: { $in: await Quiz.find({ createdBy: req.user._id }).distinct('_id') } })
                .populate('quiz', 'title')
                .populate('user', 'name rollNumber');
        }
        res.json({ success: true, results });
    } catch (err) {
        console.error('Error fetching results:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch results',
            error: err.message 
        });
    }
});

app.get('/api/quizzes/:id/results/export', authenticate, authorize(['staff', 'admin']), async (req, res) => {
    try {
        // Validate quiz ID
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid quiz ID format' 
            });
        }

        // Get quiz details
        const quiz = await Quiz.findById(req.params.id).select('title createdBy').lean();
        if (!quiz) {
            return res.status(404).json({ 
                success: false, 
                message: 'Quiz not found' 
            });
        }

        // Check authorization
        if (quiz.createdBy.toString() !== req.user._id && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized to export these results' 
            });
        }

        console.log(`Starting export for quiz: ${quiz.title} (${req.params.id})`);
        
        // Get all results for this quiz
        const results = await QuizResult.find({ quiz: req.params.id })
            .sort({ submittedAt: 1 }) // Sort by submission time
            .lean();
            
        console.log(`Found ${results.length} results to export`);

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No results found for this quiz'
            });
        }

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Quiz Results');

        // Define columns with appropriate widths (removed Total Marks and Percentage)
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8, style: { numFmt: '0' } },
            { header: 'Roll Number', key: 'rollNumber', width: 15 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Department', key: 'department', width: 20 },
            { header: 'Section', key: 'section', width: 10 },
            { header: 'Batch', key: 'batch', width: 10 },
            { header: 'Score', key: 'score', width: 10, style: { numFmt: '0.00' } },
            { 
                header: 'Submitted At', 
                key: 'submittedAt', 
                width: 22,
                style: { 
                    numFmt: 'dd-mm-yyyy hh:mm:ss',
                    alignment: { horizontal: 'left' }
                }
            },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Style for header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { 
            bold: true, 
            color: { argb: 'FFFFFFFF' },
            size: 12
        };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F81BD' } // Dark blue
        };
        headerRow.alignment = { 
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true 
        };
        headerRow.height = 25;

        // Set default row height
        worksheet.properties.defaultRowHeight = 20;

        // Process each result
        let rowNumber = 1;
        const processedResults = [];
        let successCount = 0;
        let errorCount = 0;

        for (const result of results) {
            try {
                if (!result.user) {
                    throw new Error('User reference is missing');
                }

                // Get user data directly for each result
                const user = await User.findById(result.user)
                    .select('name rollNumber department batch section email')
                    .lean()
                    .catch(() => null); // Handle case where user might be deleted
                
                // Prepare row data
                const rowData = {
                    sno: rowNumber,
                    rollNumber: user?.rollNumber?.toString() || 'N/A',
                    name: user?.name?.trim() || 'User Not Found',
                    department: user?.department || 'N/A',
                    section: user?.section || 'N/A',
                    batch: user?.batch || 'N/A',
                    score: result.score || 0,
                    submittedAt: result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A'
                };

                // Add the row to the worksheet
                worksheet.addRow(rowData);
                rowNumber++;
                successCount++;

                console.log(`Added row for user: ${user?.rollNumber || 'Unknown'}`);
            } catch (error) {
                console.error(`Error processing result ${result._id}:`, error);
                // Add error row if there's an issue
                worksheet.addRow({
                    sno: rowNumber,
                    rollNumber: 'ERROR',
                    name: 'Error processing user data',
                    department: 'N/A',
                    section: 'N/A',
                    batch: 'N/A',
                    score: 0,
                    submittedAt: new Date().toLocaleString(),
                    status: 'Error'
                });
                rowNumber++;
                errorCount++;
            }
        }

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 0;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = Math.min(Math.max(maxLength + 2, column.header.length + 2), 50);
        });

        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        const fileName = `quiz_results_${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        // Write and send the file
        await workbook.xlsx.write(res);
        res.end();
        console.log('Export completed successfully');
    } catch (err) {
        console.error('Error exporting results:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to export results',
            error: err.message 
        });
    }
});

// Debug Routes
app.get('/api/debug/time', (req, res) => {
res.json({ 
    serverTime: new Date(),
    isoString: new Date().toISOString()
});
});

app.get('/api/debug/quiz-times/:id', async (req, res) => {
try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
    return res.status(404).json({ success: false, message: 'Quiz not found' });
    }
    
    res.json({
    success: true,
    quiz: {
        id: quiz._id,
        title: quiz.title,
        startTime: quiz.startTime,
        endTime: quiz.endTime,
        serverTime: new Date()
    }
    });
} catch (err) {
    res.status(500).json({ success: false, message: err.message });
}
});
// Add this route with your other result routes
// Get detailed quiz result (with correct answers)
app.get('/api/results/:id/details', authenticate, authorize(['student']), async (req, res) => {
    try {
        const resultId = req.params.id;
        
        const result = await QuizResult.findById(resultId)
            .populate('quiz')
            .populate('user', 'name rollNumber');
        
        if (!result) {
            return res.status(404).json({ 
                success: false, 
                message: 'Result not found' 
            });
        }

        // Verify the requesting user owns this result
        if (result.user._id.toString() !== req.user._id) {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized to view this result' 
            });
        }

        const quiz = await Quiz.findById(result.quiz._id);
        const now = new Date();
        
        // Only allow access after quiz end time
        if (now < quiz.endTime) {
            return res.status(403).json({ 
                success: false, 
                message: 'Quiz results are only available after the quiz has ended' 
            });
        }

        res.json({
            success: true,
            result: {
                ...result.toObject(),
                quiz: {
                    ...quiz.toObject(),
                    questions: quiz.questions.map(q => ({
                        questionText: q.questionText,
                        imageUrl: q.imageUrl,
                        options: q.options,
                        correctAnswer: q.correctAnswer,
                        points: q.points
                    }))
                }
            }
        });
    } catch (err) {
        console.error('Error fetching result details:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch result details',
            error: err.message 
        });
    }
});
app.put('/api/users/profile', authenticate, async (req, res) => {
    console.log('=== PROFILE UPDATE REQUEST ===');
    console.log('User ID:', req.user._id);
    console.log('Request body:', req.body);
  
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { name, department, section, batch, newPassword, rollNumber } = req.body;
      const userId = req.user._id;
  
      // Find user
      const user = await User.findById(userId).session(session);
      if (!user) {
        console.error('User not found:', userId);
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      
      // Check if rollNumber is being changed and validate it
      if (rollNumber && rollNumber !== user.rollNumber) {
        // Check if new roll number already exists
        const existingUser = await User.findOne({ rollNumber }).session(session);
        if (existingUser) {
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            success: false,
            message: 'Roll number already in use',
            field: 'rollNumber'
          });
        }
        user.rollNumber = rollNumber;
      }
  
      // Update basic info
      if (name) user.name = name;
      if (department) user.department = department;
      
      // Only update section and batch for non-staff users
      if (user.role !== 'staff') {
        if (section !== undefined) user.section = section;
        if (batch !== undefined) user.batch = batch;
      }
  
      // Update password if provided
      if (newPassword && newPassword.trim() !== '') {
        console.log('Updating password for user:', user.rollNumber);
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, 10);
      }
  
      // Save changes
      const updatedUser = await user.save({ session });
      console.log('User updated successfully:', updatedUser);
      
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
  
      // Prepare response data
      const userData = {
        _id: updatedUser._id,
        name: updatedUser.name,
        rollNumber: updatedUser.rollNumber,
        role: updatedUser.role,
        department: updatedUser.department,
        section: updatedUser.section,
        batch: updatedUser.batch
      };
  
      // Generate new token if password was changed
      let token;
      if (newPassword && newPassword.trim() !== '') {
        token = jwt.sign(
          { 
            _id: updatedUser._id, 
            role: updatedUser.role, 
            name: updatedUser.name,
            department: updatedUser.department,
            batch: updatedUser.batch
          },
          process.env.JWT_SECRET || 'quizappsecret',
          { expiresIn: '1h' }
        );
        console.log('New token generated for user:', updatedUser.rollNumber);
      }
  
      const response = {
        success: true,
        message: 'Profile updated successfully',
        user: userData
      };
      
      if (token) {
        response.token = token;
      }
  
      console.log('Sending response:', response);
      res.json(response);
  
    } catch (err) {
      console.error('Profile update error:', err);
      await session.abortTransaction();
      session.endSession();
      
      let statusCode = 500;
      let errorMessage = 'Failed to update profile';
      
      if (err.code === 11000) { // Duplicate key error
        statusCode = 409;
        errorMessage = 'Roll number already in use';
      }
      
      const errorResponse = { 
        success: false, 
        message: errorMessage,
        error: err.message,
        ...(err.code === 11000 && { field: 'rollNumber' })
      };
      
      console.error('Error response:', errorResponse);
      res.status(statusCode).json(errorResponse);
    }
  });
// Add this with other user management routes
app.put('/api/users/:id/password', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.params.id;
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'New password must be at least 6 characters long' 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ 
            success: true,
            message: 'Password updated successfully'
        });
    } catch (err) {
        console.error('Error updating password:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update password',
            error: err.message 
        });
    }
});
// AI Quiz Generation Endpoint - Simplified and Robust
app.post('/api/ai/generate-quiz', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  console.log('AI Quiz Generation Request Received');
  console.log('Request body:', req.body);

  try {
    const { text, topics } = req.body;
    // Accept numQuestions from either top-level or nested under options (from frontend)
    const rawNumQ = (req.body && (req.body.numQuestions ?? req.body.options?.numQuestions));
    let numQuestions = rawNumQ ? parseInt(rawNumQ) : 10; // default 10

    // Validate input
    if (!text && !topics) {
      return res.status(400).json({
        success: false,
        message: 'Either text content or topics are required'
      });
    }

    const { generateQuizFromText } = require('./utils/aiQuizGenerator');

    // Generate quiz
    const quizData = await generateQuizFromText(text || topics, {
      numQuestions,
      topics: topics || text
    });

    console.log('Quiz generated successfully:', {
      title: quizData.title,
      questionCount: quizData.questions?.length || 0
    });

    res.json({
      success: true,
      quiz: quizData
    });

  } catch (error) {
    console.error('AI Quiz Generation Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate quiz: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get results for a specific quiz
app.get('/api/quizzes/:id/results', authenticate, authorize(['staff', 'admin']), async (req, res) => {
    try {
        const quizId = req.params.id;
        
        // Verify the requesting user created this quiz or is admin
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ 
                success: false, 
                message: 'Quiz not found' 
            });
        }

        if (quiz.createdBy.toString() !== req.user._id && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized to view these results' 
            });
        }

        const results = await QuizResult.find({ quiz: quizId })
            .populate('user', 'name rollNumber department batch');

        res.json({ 
            success: true,
            results 
        });
    } catch (err) {
        console.error('Error fetching quiz results:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch quiz results',
            error: err.message 
        });
    }
});
app.get('/api/debug/quizzes', async (req, res) => {
const quizzes = await Quiz.find({});
res.json({ quizzes });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

const PORT = process.env.PORT || 5000;
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the API at http://localhost:${PORT}`);
});
// Add this route with the other user management routes
app.post('/api/ai/generate-quiz', async (req, res) => {
  try {
    res.json({
      success: true,
      message: "AI quiz route working"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error generating quiz"
    });
  }
});
app.post('/api/users/staff', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { name, rollNumber, password, department } = req.body;
        
        if (!name || !rollNumber || !password || !department) {
            return res.status(400).json({ 
                success: false,
                message: 'Missing required fields: name, rollNumber, password, department' 
            });
        }

        const existingUser = await User.findOne({ rollNumber });
        if (existingUser) {
            return res.status(409).json({ 
                success: false,
                message: 'User already exists with this roll number' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({
            name,
            rollNumber,
            password: hashedPassword,
            role: 'staff',
            department,
            isApproved: true
        });

        await user.save();
        
        res.status(201).json({ 
            success: true,
            message: 'Staff account created successfully',
            user: {
                id: user._id,
                name: user.name,
                rollNumber: user.rollNumber,
                department: user.department
            }
        });
    } catch (err) {
        console.error('Error creating staff account:', err);
        res.status(500).json({ 
            success: false,
            message: 'Failed to create staff account',
            error: err.message 
        });
    }
});// PUT endpoint to edit quiz
app.put('/api/quizzes/:quizId', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { title, description, questions, startTime, endTime, duration, department, batch } = req.body;
    const quizId = req.params.quizId;
    
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }
    
    // Check permissions
    if (req.user.role !== 'admin' && quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this quiz' });
    }
    
    // Update fields
    if (title) quiz.title = title;
    if (description) quiz.description = description;
    if (questions) {
      let parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;
      quiz.questions = parsedQuestions;
    }
    if (startTime) quiz.startTime = new Date(startTime);
    if (endTime) quiz.endTime = new Date(endTime);
    if (duration) quiz.duration = Number(duration);
    if (department) quiz.department = department;
    if (batch) quiz.batch = batch;
    
    await quiz.save();
    
    res.json({ success: true, message: 'Quiz updated successfully', quiz });
  } catch (err) {
    console.error('Error updating quiz:', err);
    res.status(500).json({ success: false, message: 'Failed to update quiz', error: err.message });
  }
});

// PUT endpoint to publish/unpublish quiz
app.put('/api/quizzes/:quizId/publish', authenticate, authorize(['staff', 'admin']), async (req, res) => {
  try {
    const { status } = req.body; // 'published' or 'draft'
    const quizId = req.params.quizId;
    
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }
    
    // Check permissions
    if (req.user.role !== 'admin' && quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to publish this quiz' });
    }
    
    quiz.status = status || 'published';
    quiz.isVisible = status === 'published';
    
    await quiz.save();
    
    res.json({ success: true, message: `Quiz ${status === 'published' ? 'published' : 'unpublished'} successfully`, quiz });
  } catch (err) {
    console.error('Error publishing quiz:', err);
    res.status(500).json({ success: false, message: 'Failed to publish quiz', error: err.message });
  }
});

// GET endpoint for students to see only published quizzes
app.get('/api/quizzes/published', authenticate, authorize(['student']), async (req, res) => {
  try {
    const now = new Date();
    
    const quizzes = await Quiz.find({
      status: 'published',
      isVisible: true,
      startTime: { $lte: now },
      endTime: { $gte: now }
    }).populate('createdBy', 'name');

    res.json({ 
      success: true,
      quizzes 
    });
  } catch (err) {
    console.error('Error fetching published quizzes:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch published quizzes',
      error: err.message 
    });
  }
});
