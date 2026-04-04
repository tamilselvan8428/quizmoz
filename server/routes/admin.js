const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get pending users
router.get('/users/pending', async (req, res) => {
    try {
        const pendingUsers = await User.find({ isApproved: false })
            .select('-password')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            users: pendingUsers
        });
    } catch (error) {
        console.error('Error fetching pending users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending users',
            error: error.message
        });
    }
});

// Get deleted users (soft deleted)
router.get('/deleted-users', async (req, res) => {
    try {
        const deletedUsers = await User.find({ isDeleted: true })
            .select('-password')
            .sort({ deletedAt: -1 });

        res.json({
            success: true,
            deletedUsers: deletedUsers
        });
    } catch (error) {
        console.error('Error fetching deleted users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch deleted users',
            error: error.message
        });
    }
});

// Approve pending users
router.post('/users/approve', async (req, res) => {
    try {
        const { userIds } = req.body;

        await User.updateMany(
            { _id: { $in: userIds } },
            { isApproved: true }
        );

        res.json({
            success: true,
            message: 'Users approved successfully'
        });
    } catch (error) {
        console.error('Error approving users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve users',
            error: error.message
        });
    }
});

// Restore user
router.post('/users/restore/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { newRollNumber } = req.body;

        // Check if roll number already exists
        const existingUser = await User.findOne({ rollNumber: newRollNumber });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Roll number already exists',
                conflict: {
                    existingUserId: existingUser._id,
                    existingUserName: existingUser.name,
                    rollNumber: existingUser.rollNumber
                }
            });
        }

        await User.findByIdAndUpdate(id, {
            isDeleted: false,
            deletedAt: null,
            rollNumber: newRollNumber
        });

        res.json({
            success: true,
            message: 'User restored successfully'
        });
    } catch (error) {
        console.error('Error restoring user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to restore user',
            error: error.message
        });
    }
});

// Soft delete user
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await User.findByIdAndUpdate(id, {
            isDeleted: true,
            deletedAt: new Date()
        });

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user',
            error: error.message
        });
    }
});

// Permanent delete user
router.delete('/users/permanent/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await User.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'User permanently deleted'
        });
    } catch (error) {
        console.error('Error permanently deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to permanently delete user',
            error: error.message
        });
    }
});

// Update user password
router.put('/users/:id/password', async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update password',
            error: error.message
        });
    }
});

module.exports = router;
