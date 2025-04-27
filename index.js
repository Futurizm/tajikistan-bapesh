const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const authRouter = require('./routers/authRouter');
const initializeRoles = require('./config/roles');
const setupSocket = require('./socket/socketHandler');
const cors = require('cors');
const friendsRouter = require('./routers/friendsRouter');
const profileRouter = require('./routers/profileRouter');
const postsRouter = require('./routers/postsRouter');
const messagesRouter = require('./routers/messagesRouter');
const usersRouter = require('./routers/usersRouter');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 5000;

// Создание папки Uploads
const uploadsPath = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(UploadsPath, { recursive: true });
    console.log(`[Server] Created Uploads directory: ${uploadsPath}`);
}

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use((req, res, next) => {
    console.log(`[Server] Request: ${req.method} ${req.url}, Cookies: ${req.headers.cookie || 'none'}`);
    const originalSend = res.send.bind(res);
    res.send = function(body) {
        console.log(`[Server] Response: ${req.method} ${req.url}, Status: ${res.statusCode}, Headers: ${JSON.stringify(res.getHeaders())}`);
        return originalSend(body);
    };
    next();
});
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/posts', postsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);

// Static files
console.log(`[Server] Serving static files from: ${uploadsPath}`);
app.use('/Uploads', express.static(uploadsPath));
app.use(express.static(path.join(__dirname, '..', 'client')));

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: 'API route not found' });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        credentials: true,
    },
});

// Initialize roles and Socket.IO
const start = async() => {
    try {
        await initializeRoles();
        setupSocket(io);
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.log('Error starting the server:', error);
    }
};

start();