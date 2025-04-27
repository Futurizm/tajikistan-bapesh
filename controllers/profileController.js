const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs').promises;

class ProfileController {
    async getMyProfile(req, res) {
        try {
            const { userId } = req.user;
            console.log(`[GET /api/profile] Fetching profile for userId: ${userId}`);

            const user = await prisma.users.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    profilePicture: true,
                    bio: true,
                    phone: true,
                    location: true,
                    skills: true,
                    userFriendships: { where: { status: "accepted" } },
                    friendFriendships: { where: { status: "accepted" } },
                    posts: { select: { id: true } },
                },
            });

            if (!user) {
                console.log(`[GET /api/profile] User not found for userId: ${userId}`);
                return res.status(404).json({ message: 'User not found' });
            }

            const profile = {
                id: user.id,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture
                    ? `http://localhost:5000/uploads/profiles/${path.basename(user.profilePicture)}`
                    : null,
                bio: user.bio || null,
                phone: user.phone || null,
                location: user.location || null,
                skills: user.skills || [],
                friendsCount: user.userFriendships.length + user.friendFriendships.length,
                postsCount: user.posts.length,
                eventsCount: user.posts.length,
            };

            console.log(`[GET /api/profile] Profile fetched:`, {
                id: profile.id,
                username: profile.username,
                profilePicture: profile.profilePicture,
                rawProfilePicture: user.profilePicture,
            });
            res.json(profile);
        } catch (error) {
            console.error(`[GET /api/profile] Error:`, error.message, error.stack);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    }

    async getProfileById(req, res) {
        try {
            const userId = parseInt(req.params.userId, 10);
            console.log(`[GET /api/profile/${userId}] Fetching profile for userId: ${userId}`);

            if (isNaN(userId)) {
                console.log(`[GET /api/profile/${req.params.userId}] Invalid userId: ${req.params.userId}`);
                return res.status(400).json({ message: 'Invalid user ID' });
            }

            const user = await prisma.users.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    profilePicture: true,
                    bio: true,
                    phone: true,
                    location: true,
                    skills: true,
                    userFriendships: { where: { status: "accepted" } },
                    friendFriendships: { where: { status: "accepted" } },
                    posts: { select: { id: true } },
                },
            });

            if (!user) {
                console.log(`[GET /api/profile/${userId}] User not found`);
                return res.status(404).json({ message: 'User not found' });
            }

            const profile = {
                id: user.id,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture
                    ? `http://localhost:5000/uploads/profiles/${path.basename(user.profilePicture)}`
                    : null,
                bio: user.bio || null,
                phone: user.phone || null,
                location: user.location || null,
                skills: user.skills || [],
                friendsCount: user.userFriendships.length + user.friendFriendships.length,
                postsCount: user.posts.length,
                eventsCount: user.posts.length,
            };

            console.log(`[GET /api/profile/${userId}] Profile fetched:`, {
                id: profile.id,
                username: profile.username,
                profilePicture: profile.profilePicture,
                rawProfilePicture: user.profilePicture,
            });
            res.json(profile);
        } catch (error) {
            console.error(`[GET /api/profile/${req.params.userId}] Error:`, error.message, error.stack);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    }

    async updateProfile(req, res) {
        try {
            const { userId } = req.user;
            const { username, email, bio, phone, location, skills } = req.body;
            console.log(`[PUT /api/profile/update] Updating profile for userId: ${userId}`, req.body);

            const updatedUser = await prisma.users.update({
                where: { id: userId },
                data: {
                    username: username || undefined,
                    email: email || undefined,
                    bio: bio || undefined,
                    phone: phone || undefined,
                    location: location || undefined,
                    skills: skills || undefined,
                },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    profilePicture: true,
                    bio: true,
                    phone: true,
                    location: true,
                    skills: true,
                    userFriendships: { where: { status: "accepted" } },
                    friendFriendships: { where: { status: "accepted" } },
                    posts: { select: { id: true } },
                },
            });

            const profile = {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                profilePicture: updatedUser.profilePicture
                    ? `http://localhost:5000/uploads/profiles/${path.basename(updatedUser.profilePicture)}`
                    : null,
                bio: updatedUser.bio || null,
                phone: updatedUser.phone || null,
                location: updatedUser.location || null,
                skills: updatedUser.skills || [],
                friendsCount: updatedUser.userFriendships.length + updatedUser.friendFriendships.length,
                postsCount: updatedUser.posts.length,
                eventsCount: updatedUser.posts.length,
            };

            console.log(`[PUT /api/profile/update] Profile updated:`, {
                id: profile.id,
                username: profile.username,
                profilePicture: profile.profilePicture,
                rawProfilePicture: updatedUser.profilePicture,
            });
            res.json(profile);
        } catch (error) {
            console.error(`[PUT /api/profile/update] Error:`, error.message, error.stack);
            if (error.code === 'P2002') {
                return res.status(400).json({ message: 'Username or email already taken' });
            }
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    }

    async uploadProfilePhoto(req, res) {
        try {
            const { userId } = req.user;
            console.log(`[POST /api/profile/upload-photo] Uploading photo for userId: ${userId}`);

            if (!req.file) {
                console.log(`[POST /api/profile/upload-photo] No file uploaded`);
                return res.status(400).json({ message: 'No file uploaded' });
            }

            // Формирование имени файла и пути
            const fileExtension = path.extname(req.file.originalname);
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${fileExtension}`;
            const filePath = `/uploads/profiles/${fileName}`;
            const absolutePath = path.join(__dirname, '..', 'Uploads', 'profiles', fileName);

            // Создание папки Uploads/profiles, если не существует
            const profilesDir = path.join(__dirname, '..', 'Uploads', 'profiles');
            await fs.mkdir(profilesDir, { recursive: true });

            // Сохранение файла
            await fs.writeFile(absolutePath, req.file.buffer);
            console.log(`[POST /api/profile/upload-photo] File saved at: ${absolutePath}`);

            // Проверка существования файла
            try {
                await fs.access(absolutePath);
                console.log(`[POST /api/profile/upload-photo] File exists at: ${absolutePath}`);
            } catch (error) {
                console.error(`[POST /api/profile/upload-photo] File not found at: ${absolutePath}`, error.message);
                return res.status(500).json({ message: 'File save error', error: error.message });
            }

            // Удаление старого изображения
            const user = await prisma.users.findUnique({
                where: { id: userId },
                select: { profilePicture: true },
            });

            if (user && user.profilePicture) {
                const oldPath = path.join(__dirname, '..', user.profilePicture);
                try {
                    await fs.unlink(oldPath);
                    console.log(`[POST /api/profile/upload-photo] Old photo deleted: ${oldPath}`);
                } catch (error) {
                    console.warn(`[POST /api/profile/upload-photo] Failed to delete old photo: ${oldPath}`, error.message);
                }
            }

            // Обновление профиля в базе
            const updatedUser = await prisma.users.update({
                where: { id: userId },
                data: { profilePicture: filePath },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    profilePicture: true,
                    bio: true,
                    phone: true,
                    location: true,
                    skills: true,
                    userFriendships: { where: { status: "accepted" } },
                    friendFriendships: { where: { status: "accepted" } },
                    posts: { select: { id: true } },
                },
            });

            const profile = {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                profilePicture: updatedUser.profilePicture
                    ? `http://localhost:5000/uploads/profiles/${path.basename(updatedUser.profilePicture)}`
                    : null,
                bio: updatedUser.bio || null,
                phone: updatedUser.phone || null,
                location: updatedUser.location || null,
                skills: updatedUser.skills || [],
                friendsCount: updatedUser.userFriendships.length + updatedUser.friendFriendships.length,
                postsCount: updatedUser.posts.length,
                eventsCount: updatedUser.posts.length,
            };

            console.log(`[POST /api/profile/upload-photo] Photo uploaded:`, {
                id: profile.id,
                username: profile.username,
                profilePicture: profile.profilePicture,
                rawProfilePicture: updatedUser.profilePicture,
            });
            res.json(profile);
        } catch (error) {
            console.error(`[POST /api/profile/upload-photo] Error:`, error.message, error.stack);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    }
}

module.exports = new ProfileController();