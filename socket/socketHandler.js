const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('[socketHandler] New socket connection:', {
            socketId: socket.id,
            headers: socket.request.headers,
            cookies: socket.request.headers.cookie || 'none',
        });

        let token = socket.handshake.auth.token;
        if (!token && socket.request.headers.cookie) {
            const jwtCookie = socket.request.headers.cookie.split('; ').find(row => row.startsWith('jwt='));
            token = jwtCookie ? jwtCookie.split('=')[1] : null;
        }

        // Удаление "Bearer " если присутствует
        if (token && token.startsWith('Bearer ')) {
            token = token.replace('Bearer ', '');
            console.log('[socketHandler] Removed "Bearer" prefix from token');
        }

        console.log('[socketHandler] Token received:', {
            token: token ? 'present' : 'missing',
            length: token ? token.length : 0,
        });

        if (!token) {
            console.log('[socketHandler] No token provided for socket:', socket.id);
            socket.emit('error', { message: 'Требуется авторизация: токен отсутствует' });
            setTimeout(() => socket.disconnect(true), 100);
            return;
        }

        try {
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            console.log('[socketHandler] Token verified:', {
                userId: decoded.id,
                type: typeof decoded.id,
                decoded: Object.keys(decoded),
            });
            socket.userId = parseInt(decoded.id, 10);

            if (isNaN(socket.userId)) {
                console.log('[socketHandler] Invalid userId:', decoded.userId);
                socket.emit('error', { message: 'Недействительный ID пользователя' });
                setTimeout(() => socket.disconnect(true), 100);
                return;
            }

            socket.on('message', async(data) => {
                console.log('[socketHandler] Message received:', {
                    socketId: socket.id,
                    senderId: socket.userId,
                    data,
                });

                const { receiverId, content, id, createdAt } = data;
                if (!receiverId || !content || content.trim() === '' || !id || !createdAt) {
                    console.log('[socketHandler] Invalid message data:', { receiverId, content, id, createdAt });
                    socket.emit('error', { message: 'Недействительные данные сообщения' });
                    return;
                }

                try {
                    const parsedReceiverId = parseInt(receiverId, 10);
                    if (isNaN(parsedReceiverId)) {
                        console.log('[socketHandler] Invalid receiverId:', receiverId);
                        socket.emit('error', { message: 'Недействительный ID получателя' });
                        return;
                    }

                    // Проверяем существование сообщения в базе
                    const message = await prisma.message.findUnique({
                        where: { id },
                    });

                    if (!message) {
                        console.log('[socketHandler] Message not found in database:', { id });
                        socket.emit('error', { message: 'Сообщение не найдено' });
                        return;
                    }

                    console.log('[socketHandler] Broadcasting message:', {
                        id: message.id,
                        content: message.content,
                        senderId: socket.userId,
                        receiverId: parsedReceiverId,
                    });

                    io.to(`user-${parsedReceiverId}`).emit('message', {
                        id: message.id,
                        senderId: socket.userId,
                        receiverId: parsedReceiverId,
                        content: message.content,
                        createdAt: message.createdAt,
                    });

                    socket.emit('message', {
                        id: message.id,
                        senderId: socket.userId,
                        receiverId: parsedReceiverId,
                        content: message.content,
                        createdAt: message.createdAt,
                    });
                } catch (error) {
                    console.error('[socketHandler] Error processing message:', {
                        message: error.message,
                        stack: error.stack,
                    });
                    socket.emit('error', { message: `Не удалось обработать сообщение: ${error.message}` });
                }
            });

            socket.join(`user-${socket.userId}`);
            console.log('[socketHandler] User joined room:', `user-${socket.userId}`);

            socket.on('disconnect', () => {
                console.log('[socketHandler] Socket disconnected:', {
                    socketId: socket.id,
                    userId: socket.userId,
                });
            });
        } catch (error) {
            console.error('[socketHandler] Token verification failed:', {
                message: error.message,
                stack: error.stack,
                token: token ? 'present' : 'missing',
            });
            socket.emit('error', { message: `Недействительный токен: ${error.message}` });
            setTimeout(() => socket.disconnect(true), 100);
        }
    });
};