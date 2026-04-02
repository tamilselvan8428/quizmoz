const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/userController');

// Register user
router.post('/register', async (req, res) => {
    const result = await register(req, res);
    return result;
});

// Login user
router.post('/login', async (req, res) => {
    const result = await login(req, res);
    return result;
});

module.exports = router;
