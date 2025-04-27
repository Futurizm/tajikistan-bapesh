const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const profileController = require('../controllers/profileController');
const { uploadProfile } = require('../middleware/upload');
const multer = require('multer');

router.use(authMiddleware);

router.get('/', profileController.getMyProfile);

router.get('/:userId', profileController.getProfileById);

router.put('/update', profileController.updateProfile);

router.post(
    '/upload-photo',
    authMiddleware,
    (req, res, next) => {
        console.log(`[POST /api/profile/upload-photo] Starting upload process`);
        uploadProfile(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                console.error(`[POST /api/profile/upload-photo] Multer error:`, err);
                return res.status(400).json({ message: `Ошибка загрузки: ${err.message}` });
            } else if (err) {
                console.error(`[POST /api/profile/upload-photo] Upload error:`, err);
                return res.status(400).json({ message: `Ошибка загрузки: ${err.message}` });
            }
            next();
        });
    },
    profileController.uploadProfilePhoto
);

module.exports = router;