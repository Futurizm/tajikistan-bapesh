const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Генерация токена с учетом "Remember Me"
const generateAccessToken = (id, roles, rememberMe = false) => {
    const payload = { id: id.toString(), roles };
    const expiresIn = rememberMe ? '30d' : '24h';
    if (!process.env.SECRET_KEY) {
        throw new Error('SECRET_KEY is not defined in environment variables');
    }
    console.log('[generateAccessToken] Generating token:', { id, roles, expiresIn });
    return jwt.sign(payload, process.env.SECRET_KEY, { expiresIn });
};

// Генерация токена и ссылки
const generateTokenAndLink = (userId, purpose = 'activate') => {
    if (!process.env.SECRET_KEY) {
        throw new Error('SECRET_KEY is not defined in environment variables');
    }
    const token = jwt.sign({ id: userId.toString(), purpose }, process.env.SECRET_KEY, { expiresIn: '1h' });
    console.log('[generateTokenAndLink] Generated token for:', { userId, purpose });
    if (purpose === 'reset') {
        return `${process.env.CLIENT_URL}/forgot-password/${token}`;
    }
    return `http://localhost:5000/api/auth/activate?token=${token}`;
};

// Настройка Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Универсальная функция отправки email
const sendEmail = async (email, subject, text) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        text,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[Email] ${subject} sent to ${email}`);
    } catch (error) {
        console.error(`[Email] Error sending ${subject}:`, error.message, error.stack);
        throw error;
    }
};

class AuthController {
    async login(req, res) {
        try {
            const { email, password, rememberMe } = req.body;
            console.log('[POST /api/auth/login] Attempting login:', { email, rememberMe });

            if (!email || !password) {
                console.log('[POST /api/auth/login] Missing email or password');
                return res.status(400).json({ message: 'Email и пароль обязательны' });
            }

            const user = await prisma.users.findFirst({
                where: { email },
                include: { user_roles: { include: { roles: true } } },
            });

            if (!user) {
                console.log('[POST /api/auth/login] User not found:', email);
                return res.status(400).json({ message: 'Пользователь не найден' });
            }

            const validPassword = bcrypt.compareSync(password, user.password);
            if (!validPassword) {
                console.log('[POST /api/auth/login] Invalid password for:', email);
                return res.status(400).json({ message: 'Неверный пароль' });
            }

            if (!user.isActive) {
                console.log('[POST /api/auth/login] Account not activated:', email);
                return res.status(400).json({ message: 'Аккаунт не активирован' });
            }

            const roles = user.user_roles.map(ur => ur.roles.value);
            const token = generateAccessToken(user.id, roles, rememberMe);

            res.cookie('jwt', token, {
                httpOnly: false,
                secure: false,
                sameSite: 'lax',
                maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
                path: '/',
            });

            console.log('[POST /api/auth/login] Cookie set:', {
                tokenLength: token.length,
                userId: user.id,
                headers: res.getHeaders(),
            });
            return res.json({ message: 'Вход выполнен успешно', userId: user.id });
        } catch (error) {
            console.error('[POST /api/auth/login] Error:', error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера', error: error.message });
        }
    }

    async registration(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.log('[POST /api/auth/registration] Validation errors:', errors.array());
                return res.status(400).json({ message: 'Ошибка валидации', errors: errors.array() });
            }

            const { username, password, email } = req.body;
            console.log('[POST /api/auth/registration] Registering:', { username, email });

            const candidate = await prisma.users.findFirst({
                where: { email },
            });
            if (candidate) {
                console.log('[POST /api/auth/registration] User already exists:', email);
                return res.status(400).json({ message: 'Пользователь уже существует' });
            }

            const hashPassword = bcrypt.hashSync(password, 7);
            let userRole = await prisma.roles.findUnique({ where: { value: 'user' } });
            if (!userRole) {
                userRole = await prisma.roles.create({ data: { value: 'user' } });
                console.log('[POST /api/auth/registration] Created role:', userRole);
            }

            const newUser = await prisma.users.create({
                data: {
                    username,
                    email,
                    password: hashPassword,
                    user_roles: { create: [{ role_id: userRole.id }] },
                    isActive: false,
                },
            });

            const activationLink = generateTokenAndLink(newUser.id, 'activate');
            await sendEmail(email, 'Активация аккаунта',
                `Для завершения регистрации перейдите по ссылке: ${activationLink}`);

            console.log('[POST /api/auth/registration] User created:', { userId: newUser.id, email });
            return res.json({ message: 'Пользователь создан, отправлено письмо для активации' });
        } catch (error) {
            console.error('[POST /api/auth/registration] Error:', error.message, error.stack);
            res.status(400).json({ message: 'Ошибка регистрации', error: error.message });
        }
    }

    async activateAccount(req, res) {
        try {
            const { token } = req.query;
            console.log('[GET /api/auth/activate] Activating account:', { token });

            if (!process.env.SECRET_KEY) {
                console.error('[GET /api/auth/activate] SECRET_KEY is not defined');
                return res.status(500).json({ message: 'Ошибка конфигурации сервера' });
            }

            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            if (decoded.purpose !== 'activate') {
                console.log('[GET /api/auth/activate] Invalid token purpose');
                return res.status(400).json({ message: 'Недействительное назначение токена' });
            }

            const user = await prisma.users.findUnique({ where: { id: parseInt(decoded.id) } });
            if (!user || user.isActive) {
                console.log('[GET /api/auth/activate] User not found or already activated:', decoded.id);
                return res.status(400).json({ message: 'Пользователь не найден или уже активирован' });
            }

            await prisma.users.update({
                where: { id: parseInt(decoded.id) },
                data: { isActive: true },
            });

            console.log('[GET /api/auth/activate] Account activated:', decoded.id);
            return res.redirect(process.env.CLIENT_URL || "http://localhost:3000");
        } catch (error) {
            console.error('[GET /api/auth/activate] Error:', error.message, error.stack);
            res.status(400).json({ message: 'Недействительный или истёкший токен' });
        }
    }

    async logout(req, res) {
        try {
            console.log('[POST /api/auth/logout] Logging out');
            res.clearCookie('jwt', {
                httpOnly: false,
                secure: false,
                sameSite: 'lax',
            });
            return res.json({ message: 'Выход выполнен успешно' });
        } catch (error) {
            console.error('[POST /api/auth/logout] Error:', error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    }

    async getUsers(req, res) {
        try {
            console.log('[GET /api/auth/users] Fetching users');
            const users = await prisma.users.findMany({
                include: { user_roles: { include: { roles: true } } },
            });

            const formattedUsers = users.map(user => ({
                id: user.id,
                username: user.username,
                email: user.email,
                roles: user.user_roles.map(ur => ur.roles.value),
                isActive: user.isActive,
            }));

            console.log('[GET /api/auth/users] Users fetched:', formattedUsers.length);
            res.json(formattedUsers);
        } catch (error) {
            console.error('[GET /api/auth/users] Error:', error.message, error.stack);
            res.status(500).json({ message: 'Ошибка получения пользователей' });
        }
    }

    async requestPasswordReset(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.log('[POST /api/auth/request-password-reset] Validation errors:', errors.array());
                return res.status(400).json({ message: 'Ошибка валидации', errors: errors.array() });
            }
            const { email } = req.body;
            console.log('[POST /api/auth/request-password-reset] Requesting password reset:', email);

            const user = await prisma.users.findUnique({ where: { email } });
            if (!user) {
                console.log('[POST /api/auth/request-password-reset] User not found:', email);
                return res.json({ message: 'Если email существует, ссылка для сброса пароля будет отправлена' });
            }

            const resetToken = jwt.sign({ id: user.id.toString(), purpose: 'reset' }, process.env.SECRET_KEY, { expiresIn: '30m' });

            await prisma.passwordResetToken.create({
                data: {
                    token: resetToken,
                    userId: user.id,
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
                },
            });

            const resetLink = generateTokenAndLink(user.id, 'reset');
            await sendEmail(email, 'Сброс пароля',
                `Для сброса пароля перейдите по ссылке: ${resetLink}\nСсылка действительна 30 минут.`);

            console.log('[POST /api/auth/request-password-reset] Reset link sent:', email);
            return res.json({ message: 'Ссылка для сброса пароля отправлена на ваш email' });
        } catch (error) {
            console.error('[POST /api/auth/request-password-reset] Error:', error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    }

    async resetPassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.log('[POST /api/auth/reset-password] Validation errors:', errors.array());
                return res.status(400).json({ message: 'Ошибка валидации', errors: errors.array() });
            }

            const { token, newPassword } = req.body;
            console.log('[POST /api/auth/reset-password] Resetting password:', { token });

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.SECRET_KEY);
            } catch (err) {
                console.log('[POST /api/auth/reset-password] Invalid token');
                return res.status(400).json({ message: 'Недействительный или истёкший токен' });
            }

            if (decoded.purpose !== 'reset') {
                console.log('[POST /api/auth/reset-password] Invalid token purpose');
                return res.status(400).json({ message: 'Недействительное назначение токена' });
            }

            const resetToken = await prisma.passwordResetToken.findUnique({
                where: { token },
            });

            if (!resetToken || resetToken.expiresAt < new Date()) {
                console.log('[POST /api/auth/reset-password] Token expired or not found');
                return res.status(400).json({ message: 'Недействительный или истёкший токен' });
            }

            const hashPassword = bcrypt.hashSync(newPassword, 7);

            await prisma.users.update({
                where: { id: resetToken.userId },
                data: { password: hashPassword },
            });

            await prisma.passwordResetToken.delete({
                where: { id: resetToken.id },
            });

            console.log('[POST /api/auth/reset-password] Password reset for user:', resetToken.userId);
            return res.json({ message: 'Пароль успешно сброшен' });
        } catch (error) {
            console.error('[POST /api/auth/reset-password] Error:', error.message, error.stack);
            res.status(400).json({ message: 'Недействительный или истёкший токен' });
        }
    }

    async verifyToken(req, res) {
        try {
            const { token } = req.body;
            console.log('[POST /api/auth/verify] Verifying token');
            jwt.verify(token, process.env.SECRET_KEY);
            return res.json({ message: 'Токен действителен' });
        } catch (error) {
            console.error('[POST /api/auth/verify] Error:', error.message, error.stack);
            return res.status(401).json({ message: 'Недействительный или истёкший токен' });
        }
    }

    async getUser(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            console.log('[GET /api/auth/user] Fetching user:', { userId, user: req.user, cookie: req.cookies.jwt });

            if (isNaN(userId)) {
                console.error('[GET /api/auth/user] Invalid userId:', req.user.id);
                return res.status(400).json({ message: 'Недействительный ID пользователя' });
            }

            const user = await prisma.users.findUnique({
                where: { id: userId },
                include: {
                    user_roles: { include: { roles: true } },
                    userFriendships: { where: { status: 'accepted' } },
                    friendFriendships: { where: { status: 'accepted' } },
                    posts: { select: { id: true } },
                },
            });

            if (!user) {
                console.log('[GET /api/auth/user] User not found:', userId);
                return res.status(404).json({ message: 'Пользователь не найден' });
            }

            const formattedUser = {
                id: user.id.toString(),
                username: user.username,
                email: user.email,
                roles: user.user_roles.map(ur => ur.roles.value),
                isActive: user.isActive,
                profilePicture: user.profilePicture ? `/Uploads/${user.profilePicture}` : null,
                bio: user.bio || '',
                phone: user.phone || '',
                location: user.location || '',
                age: user.age || null,
                skills: user.skills || [],
                friendsCount: user.userFriendships.length + user.friendFriendships.length,
                postsCount: user.posts.length,
                eventsCount: user.posts.length,
            };

            console.log('[GET /api/auth/user] User fetched:', formattedUser);
            return res.json(formattedUser);
        } catch (error) {
            console.error('[GET /api/auth/user] Error:', error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера', error: error.message });
        }
    }

    async updateUser(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            const { username, bio, phone, location, skills } = req.body;
            console.log('[PUT /api/auth/user] Updating user:', { 
                userId, 
                username, 
                bio, 
                phone, 
                location, 
                skills: skills ? JSON.parse(skills) : undefined,
                hasFile: !!req.file,
                fileName: req.file?.filename,
            });

            if (isNaN(userId)) {
                console.log('[PUT /api/auth/user] Invalid userId:', req.user.id);
                return res.status(400).json({ message: 'Недействительный ID пользователя' });
            }

            const user = await prisma.users.findUnique({ where: { id: userId } });
            if (!user) {
                console.log('[PUT /api/auth/user] User not found:', userId);
                return res.status(404).json({ message: 'Пользователь не найден' });
            }

            // Если загружен новый аватар, удаляем старый
            if (req.file && user.profilePicture) {
                const oldPicturePath = path.join(__dirname, '..', 'Uploads', user.profilePicture);
                if (fs.existsSync(oldPicturePath)) {
                    fs.unlinkSync(oldPicturePath);
                    console.log('[PUT /api/auth/user] Removed old profile picture:', user.profilePicture);
                }
            }

            const updatedUser = await prisma.users.update({
                where: { id: userId },
                data: {
                    username: username || user.username,
                    bio: bio !== undefined ? bio : user.bio,
                    phone: phone !== undefined ? phone : user.phone,
                    location: location !== undefined ? location : user.location,
                    skills: skills ? JSON.parse(skills) : user.skills,
                    profilePicture: req.file ? req.file.filename : user.profilePicture,
                },
                include: {
                    user_roles: { include: { roles: true } },
                    userFriendships: { where: { status: 'accepted' } },
                    friendFriendships: { where: { status: 'accepted' } },
                    posts: { select: { id: true } },
                },
            });

            const formattedUser = {
                id: updatedUser.id.toString(),
                username: updatedUser.username,
                email: updatedUser.email,
                roles: updatedUser.user_roles.map(ur => ur.roles.value),
                isActive: updatedUser.isActive,
                profilePicture: updatedUser.profilePicture ? `/Uploads/profiles/${updatedUser.profilePicture}` : null,
                bio: updatedUser.bio || '',
                phone: updatedUser.phone || '',
                location: updatedUser.location || '',
                age: updatedUser.age || null,
                skills: updatedUser.skills || [],
                friendsCount: updatedUser.userFriendships.length + updatedUser.friendFriendships.length,
                postsCount: updatedUser.posts.length,
                eventsCount: updatedUser.posts.length,
            };

            console.log('[PUT /api/auth/user] User updated:', { id: formattedUser.id, username: formattedUser.username });
            res.json(formattedUser);
        } catch (error) {
            console.error('[PUT /api/auth/user] Error:', error.message, error.stack);
            res.status(500).json({ message: 'Ошибка сервера', error: error.message });
        }
    }
}

module.exports = new AuthController();