const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static folder for uploads
app.use('/uploads', express.static('uploads'));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/foods', require('./routes/foodRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/promotions', require('./routes/promotionRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: '🦀 Dine Wave API - Authentic Sri Lankan Flavors',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            foods: '/api/foods',
            categories: '/api/categories',
            orders: '/api/orders',
            reviews: '/api/reviews',
            promotions: '/api/promotions',
            users: '/api/users',
        },
    });
});

// Socket.io Connection
io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Join user-specific room for notifications
    socket.on('joinRoom', (userId) => {
        socket.join(userId);
        console.log(`👤 User ${userId} joined their room`);
    });

    // Join admin room
    socket.on('joinAdmin', () => {
        socket.join('admin');
        console.log(`👑 Admin joined admin room`);
    });

    socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
    console.log(`🚀 Dine Wave Server running on port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
});
