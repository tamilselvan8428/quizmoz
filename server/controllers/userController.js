const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register new user
const register = async (req, res) => {
    try {
        const { name, rollNumber, password, role, department, batch } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ rollNumber });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Roll number already registered'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = new User({
            name,
            rollNumber,
            password: hashedPassword,
            role: role || 'student',
            department: department || '',
            batch: batch || '',
            isApproved: role === 'student' // Auto-approve students
        });

        await user.save();

        // Generate token
        const token = jwt.sign(
            { 
                _id: user._id, 
                role: user.role, 
                name: user.name,
                department: user.department,
                batch: user.batch 
            },
            process.env.JWT_SECRET || 'quizappsecret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                _id: user._id,
                name: user.name,
                rollNumber: user.rollNumber,
                role: user.role,
                department: user.department,
                batch: user.batch,
                isApproved: user.isApproved
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
};

// Login user
const login = async (req, res) => {
    try {
        const { rollNumber, password } = req.body;

        // Find user
        const user = await User.findOne({ rollNumber });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check approval status
        if (!user.isApproved) {
            return res.status(403).json({
                success: false,
                message: 'Account not approved. Please contact administrator.'
            });
        }

        // Compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate token
        const token = jwt.sign(
            { 
                _id: user._id, 
                role: user.role, 
                name: user.name,
                department: user.department,
                batch: user.batch 
            },
            process.env.JWT_SECRET || 'quizappsecret',
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                name: user.name,
                rollNumber: user.rollNumber,
                role: user.role,
                department: user.department,
                batch: user.batch,
                isApproved: user.isApproved
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

// Create default admin
const createDefaultAdmin = async () => {
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
            
            console.log('Default admin user created');
        }
    } catch (error) {
        console.error('Error creating default admin:', error);
    }
};

// Get user profile
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
};

// Update user profile
const updateProfile = async (req, res) => {
    try {
        const { name, department, batch } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update fields
        if (name) user.name = name;
        if (department) user.department = department;
        if (batch) user.batch = batch;

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                _id: user._id,
                name: user.name,
                rollNumber: user.rollNumber,
                role: user.role,
                department: user.department,
                batch: user.batch,
                isApproved: user.isApproved
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        
        res.json({
            success: true,
            users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
};

// Create staff user (admin only)
const createStaffUser = async (req, res) => {
    try {
        const { name, rollNumber, password, department } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ rollNumber });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Roll number already registered'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create staff user
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
            message: 'Staff user created successfully',
            user: {
                _id: user._id,
                name: user.name,
                rollNumber: user.rollNumber,
                role: user.role,
                department: user.department,
                isApproved: user.isApproved
            }
        });
    } catch (error) {
        console.error('Error creating staff user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create staff user',
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    createDefaultAdmin,
    getProfile,
    updateProfile,
    getAllUsers,
    createStaffUser
};
