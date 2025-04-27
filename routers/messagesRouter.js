const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', async(req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const friendId = parseInt(req.query.friendId);
        console.log(`[GET /api/messages] Fetching messages for userId: ${userId}, friendId: ${friendId}`);

        if (isNaN(userId) || isNaN(friendId)) {
            console.log(`[GET /api/messages] Invalid userId or friendId`, { userId, friendId });
            return res.status(400).json({ message: 'Недействительный ID пользователя или друга' });
        }

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: userId, receiverId: friendId },
                    { senderId: friendId, receiverId: userId },
                ],
            },
            orderBy: { createdAt: 'asc' },
        });

        console.log(`[GET /api/messages] Messages fetched: ${messages.length}`);
        res.json(messages);
    } catch (error) {
        console.error(`[GET /api/messages] Error:`, error.message, error.stack);
        res.status(500).json({ message: 'Ошибка сервера', error: error.message });
    }
});

router.post('/', async(req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);
        const { friendId, content } = req.body;
        console.log(`[POST /api/messages] Sending message from userId: ${userId} to friendId: ${friendId}`);

        if (isNaN(userId) || isNaN(friendId)) {
            console.log(`[POST /api/messages] Invalid userId or friendId`, { userId, friendId });
            return res.status(400).json({ message: 'Недействительный ID пользователя или друга' });
        }

        if (!content || content.trim() === '') {
            console.log(`[POST /api/messages] Empty content`);
            return res.status(400).json({ message: 'Сообщение не может быть пустым' });
        }

        const sender = await prisma.users.findUnique({ where: { id: userId } });
        const receiver = await prisma.users.findUnique({ where: { id: friendId } });

        if (!sender || !receiver) {
            console.log(`[POST /api/messages] User or friend not found`, { userId, friendId });
            return res.status(404).json({ message: 'Пользователь или друг не найден' });
        }

        const message = await prisma.message.create({
            data: {
                senderId: userId,
                receiverId: friendId,
                content: content.trim(),
                createdAt: new Date(),
            },
        });

        console.log(`[POST /api/messages] Message sent:`, { id: message.id, content: message.content });
        res.status(201).json(message);
    } catch (error) {
        console.error(`[POST /api/messages] Error:`, error.message, error.stack);
        res.status(500).json({ message: 'Ошибка сервера', error: error.message });
    }
});

module.exports = router;