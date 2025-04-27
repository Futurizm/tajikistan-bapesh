const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class FriendsController {
    // Отправить запрос в друзья
    async sendRequest(req, res) {
        try {
            const { userId } = req.user; // Из JWT токена
            const { friendId } = req.body;

            // Проверка userId
            if (!userId) {
                return res.status(401).json({ message: "User not authenticated" });
            }

            // Проверка friendId
            if (!friendId) {
                return res.status(400).json({ message: "Friend ID is required" });
            }

            if (userId === friendId) {
                return res.status(400).json({ message: "You can't add yourself" });
            }

            const existingRequest = await prisma.friendship.findFirst({
                where: {
                    OR: [
                        { userId, friendId },
                        { userId: friendId, friendId: userId }
                    ]
                }
            });

            if (existingRequest) {
                return res.status(400).json({ message: "Request already exists" });
            }

            // Проверяем, существуют ли пользователи
            const user = await prisma.users.findUnique({
                where: { id: userId }
            });
            const friend = await prisma.users.findUnique({
                where: { id: friendId }
            });

            if (!user || !friend) {
                return res.status(404).json({ message: "User or friend not found" });
            }

            const friendship = await prisma.friendship.create({
                data: {
                    status: "pending",
                    user: {
                        connect: { id: userId } // Теперь userId должен быть определён
                    },
                    friend: {
                        connect: { id: friendId }
                    }
                }
            });

            res.status(201).json(friendship);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }

    // Принять/отклонить запрос
    async respondToRequest(req, res) {
        try {
            const { userId } = req.user;
            const { requestId, action } = req.body; // action: "accept" или "reject"

            const request = await prisma.friendship.findUnique({
                where: { id: requestId }
            });

            if (!request || request.friendId !== userId) {
                return res.status(404).json({ message: "Request not found" });
            }

            const updatedRequest = await prisma.friendship.update({
                where: { id: requestId },
                data: {
                    status: action === "accept" ? "accepted" : "rejected"
                }
            });

            res.json(updatedRequest);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }

    // Получить список друзей
    async getFriends(req, res) {
            try {
                const { userId } = req.user;

                const friends = await prisma.friendship.findMany({
                    where: {
                        OR: [
                            { userId, status: "accepted" },
                            { friendId: userId, status: "accepted" }
                        ]
                    },
                    include: {
                        user: { select: { id: true, username: true } },
                        friend: { select: { id: true, username: true } }
                    }
                });

                // Форматируем ответ, чтобы показать друзей, а не запросы
                const formattedFriends = friends.map(f => {
                    return f.userId === userId ? f.friend : f.user;
                });

                res.json(formattedFriends);
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Server error" });
            }
        }
        // В friendsController.js
    async searchUsers(req, res) {
        const { query } = req.query;
        const users = await prisma.users.findMany({
            where: {
                username: { contains: query, mode: 'insensitive' }
            },
            select: { id: true, username: true }
        });
        res.json(users);
    }

    async removeFriend(req, res) {
        try {
            const { userId } = req.user;
            const { friendshipId } = req.body; // Теперь берём friendshipId из тела запроса

            // Проверка friendshipId
            if (!friendshipId) {
                return res.status(400).json({ message: 'Friendship ID is required' });
            }

            // Находим запись дружбы
            const friendship = await prisma.friendship.findUnique({
                where: { id: parseInt(friendshipId) }
            });

            if (!friendship) {
                return res.status(404).json({ message: 'Friendship not found' });
            }

            // Проверяем, что текущий пользователь — участник дружбы
            if (friendship.userId !== userId && friendship.friendId !== userId) {
                return res.status(403).json({ message: 'You are not authorized to remove this friendship' });
            }

            // Удаляем дружбу
            await prisma.friendship.delete({
                where: { id: parseInt(friendshipId) }
            });

            res.json({ message: 'Friend removed' });
        } catch (error) {
            console.error('Error in removeFriend:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }

    // Получить входящие запросы
    async getPendingRequests(req, res) {
        try {
            const { userId } = req.user;

            const requests = await prisma.friendship.findMany({
                where: {
                    friendId: userId,
                    status: "pending"
                },
                include: {
                    user: { select: { id: true, username: true } }
                }
            });

            res.json(requests);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    }
}

module.exports = new FriendsController();