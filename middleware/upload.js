const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const storage = (isProfileRoute) => multer.diskStorage({
            destination: async(req, file, cb) => {
                    const uploadType = isProfileRoute ? '' : 'posts';
                    const uploadPath = path.join(__dirname, `../Uploads${uploadType ? `/${uploadType}` : ''}`);

        console.log(`[UploadMiddleware] Request path: ${req.path}`);
        console.log(`[UploadMiddleware] Determined uploadType: ${uploadType || 'root'}, uploadPath: ${uploadPath}`);

        try {
            await fs.mkdir(uploadPath, { recursive: true });
            console.log(`[UploadMiddleware] Directory ensured: ${uploadPath}`);
            cb(null, uploadPath);
        } catch (error) {
            console.error(`[UploadMiddleware] Error creating directory ${uploadPath}:`, error);
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = `${uniqueSuffix}-${file.originalname}`;
        console.log(`[UploadMiddleware] Generated filename: ${filename}`);
        cb(null, filename);
    },
});

const fileFilter = (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
        return cb(null, true);
    }
    console.error(`[UploadMiddleware] Invalid file type: ${file.mimetype}`);
    cb(new Error('Только изображения (JPEG, PNG, GIF) разрешены'), false);
};

// Multer для профиля (одно изображение)
const uploadProfile = multer({
    storage: storage(true),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single('profilePicture');

// Multer для постов (до 5 изображений)
const uploadPosts = multer({
    storage: storage(false),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).array('images', 5);

module.exports = { uploadProfile, uploadPosts };