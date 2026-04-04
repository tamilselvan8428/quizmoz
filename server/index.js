require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import models
const User = require('./models/User');
const Quiz = require('./models/Quiz');
const QuizResult = require('./models/QuizResult');

// Import controllers
const { authenticate, authorize } = require('./controllers/authController');
const { createDefaultAdmin } = require('./controllers/userController');

// Import routes
const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quizzes');
const userRoutes = require('./routes/users');
const resultRoutes = require('./routes/results');

const app = express();

// Enhanced CORS configuration
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://quizmoz.onrender.com'],
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

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// Configure storage for uploaded images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
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

// Database Connection
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000
})
.then(async () => {
    console.log('Connected to MongoDB');
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/users', userRoutes);
app.use('/api/results', resultRoutes);

// Direct routes for backward compatibility
app.post('/api/login', (req, res) => {
    const { login } = require('./controllers/userController');
    return login(req, res);
});

app.post('/api/register', (req, res) => {
    const { register } = require('./controllers/userController');
    return register(req, res);
});

// Image upload route
app.post('/api/images', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded' });
        }

        // Create image document
        const image = {
            data: fs.readFileSync(req.file.path),
            contentType: req.file.mimetype
        };

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ 
            success: true, 
            message: 'Image uploaded successfully',
            image 
        });
    } catch (err) {
        console.error('Error uploading image:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload image', 
            error: err.message 
        });
    }
});

// Serve uploaded images
app.get('/api/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const imagePath = path.join(__dirname, 'uploads', filename);
    
    if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath);
    } else {
        res.status(404).json({ success: false, message: 'Image not found' });
    }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the API at http://localhost:${PORT}`);
});
