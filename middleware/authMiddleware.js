const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = async(req, res, next) => {
    try {
        console.log('[authMiddleware] Checking token:', {
            cookie: req.cookies.jwt,
            headers: req.headers.cookie,
            cookies: req.cookies
        });
        const token = req.cookies.jwt;

        if (!token) {
            console.log('[authMiddleware] No token provided');
            return res.status(401).json({ message: 'Нет токена, авторизация отклонена' });
        }

        if (!process.env.SECRET_KEY) {
            console.error('[authMiddleware] SECRET_KEY is not defined');
            return res.status(500).json({ message: 'Ошибка конфигурации сервера' });
        }

        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        console.log('[authMiddleware] Token decoded:', {
            decoded: decoded,
            id: decoded.id,
            type: typeof decoded.id
        });

        if (!decoded.id || isNaN(parseInt(decoded.id, 10))) {
            console.error('[authMiddleware] Invalid id in token:', decoded.id);
            return res.status(401).json({ message: 'Недействительный ID пользователя в токене' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error('[authMiddleware] Error:', error.message, error.stack);
        res.status(401).json({ message: 'Недействительный токен' });
    }
};