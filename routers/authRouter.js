const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { check } = require('express-validator');
const multer = require('multer');
const path = require('path');

// Настройка multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', 'Uploads');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Только JPEG и PNG файлы разрешены'));
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 МБ
});

// Регистрация
router.post(
    '/registration', [
        check('username', 'Имя пользователя не может быть пустым').notEmpty(),
        check('password', 'Пароль должен быть от 4 до 20 символов').isLength({ min: 4, max: 20 }),
        check('email', 'Недействительный email').isEmail(),
    ],
    authController.registration
);

// Логин
router.post('/login', authController.login);

// Выход
router.post('/logout', authController.logout);

// Получение списка пользователей
router.get('/users', authMiddleware, authController.getUsers);

// Получение текущего пользователя
router.get('/user', authMiddleware, authController.getUser);

// Обновление профиля с загрузкой аватара
router.put('/user', authMiddleware, upload.single('profilePicture'), authController.updateUser);

// Активация аккаунта
router.get('/activate', authController.activateAccount);

// Запрос сброса пароля
router.post(
    '/request-password-reset', [check('email', 'Недействительный email').isEmail()],
    authController.requestPasswordReset
);

// Сброс пароля
router.post(
    '/reset-password', [
        check('newPassword', 'Пароль должен быть от 4 до 20 символов').isLength({ min: 4, max: 20 }),
        check('token', 'Токен обязателен').notEmpty(),
    ],
    authController.resetPassword
);

// Проверка токена
router.post('/verify', authController.verifyToken);

module.exports = router;