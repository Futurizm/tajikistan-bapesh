const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Получение данных пользователя по ID
router.get('/:id', async(req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            console.log(`[GET /api/users/${req.params.id}] Invalid userId: ${req.params.id}`);
            return res.status(400).json({ message: 'Invalid user ID' });
        }
        console.log(`[GET /api/users/${userId}] Fetching user`);
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, username: true, profilePicture: true },
        });
        if (!user) {
            console.log(`[GET /api/users/${userId}] User not found`);
            return res.status(404).json({ message: 'User not found' });
        }
        console.log(`[GET /api/users/${userId}] User fetched:`, user);
        res.json({
            id: user.id,
            username: user.username,
            profilePicture: user.profilePicture ? `http://localhost:5000${user.profilePicture}` : null,
        });
    } catch (error) {
        console.error(`[GET /api/users/:id] Error:`, error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;