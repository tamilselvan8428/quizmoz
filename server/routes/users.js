const express = require('express');
const router = express.Router();
const { 
    getProfile, 
    updateProfile, 
    getAllUsers, 
    createStaffUser 
} = require('../controllers/userController');

// Get user profile
router.get('/profile', async (req, res) => {
    const result = await getProfile(req, res);
    return result;
});

// Update user profile
router.put('/profile', async (req, res) => {
    const result = await updateProfile(req, res);
    return result;
});

// Get all users (admin only)
router.get('/', async (req, res) => {
    const result = await getAllUsers(req, res);
    return result;
});

// Create staff user (admin only)
router.post('/staff', async (req, res) => {
    const result = await createStaffUser(req, res);
    return result;
});

module.exports = router;
