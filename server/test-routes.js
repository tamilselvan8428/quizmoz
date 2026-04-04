require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

// Test auth routes
app.post('/api/login', (req, res) => {
    console.log('Login request received:', req.body);
    res.json({ 
        success: true, 
        message: 'Login endpoint working',
        body: req.body
    });
});

app.post('/api/register', (req, res) => {
    console.log('Register request received:', req.body);
    res.json({ 
        success: true, 
        message: 'Register endpoint working',
        body: req.body
    });
});

// Test route
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is running!',
        timestamp: new Date().toISOString(),
        routes: ['/api/login', '/api/register', '/api/test']
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log(`Access API at http://localhost:${PORT}`);
    console.log(`Test endpoints:`);
    console.log(`  POST http://localhost:${PORT}/api/login`);
    console.log(`  POST http://localhost:${PORT}/api/register`);
    console.log(`  GET  http://localhost:${PORT}/api/test`);
});
