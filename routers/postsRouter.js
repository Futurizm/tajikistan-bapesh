const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const PostsController = require('../controllers/postsController');

// Создаем папку Uploads/posts/, если она не существует
const uploadDir = 'Uploads/posts/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        if (!file.originalname || typeof file.originalname !== 'string') {
            return cb(new Error('Invalid file name'), false);
        }
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, uniqueSuffix + ext);
    },
});

const fileFilter = (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        return cb(new Error('Файл не является изображением'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // 5MB, max 10 файлов
}).array('images', 10);

// Middleware для обработки ошибок Multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error('[POST /api/posts] Multer error:', err.message, err.stack);
        return res.status(400).json({ message: `Ошибка загрузки файлов: ${err.message}` });
    }
    if (err) {
        console.error('[POST /api/posts] File upload error:', err.message, err.stack);
        return res.status(400).json({ message: err.message || 'Ошибка загрузки файлов' });
    }
    next();
};

// Маршруты
router.post('/', authMiddleware, upload, handleMulterError, PostsController.createPost);
router.get('/', PostsController.getPosts);
router.get('/top-agents', PostsController.getTopAgents);
router.get('/trending', PostsController.getTrendingProperties);
router.get('/feed', PostsController.getAllPosts);
router.get('/user/:userId', PostsController.getUserPosts);
router.get('/my', authMiddleware, PostsController.getMyPosts);
router.get('/:id', PostsController.getPostById); // Перемещен ниже
router.delete('/:id', authMiddleware, PostsController.deletePost);
router.post('/:postId/like', authMiddleware, PostsController.toggleLike);
router.post('/multiple', PostsController.getMultiplePosts);

module.exports = router;