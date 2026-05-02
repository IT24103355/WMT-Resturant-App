import { io } from 'socket.io-client';
import api, { API_BASE_URL } from '../api/axios';

let socket = null;

export const initializeSocket = (user) => {
    try {
        if (!API_BASE_URL) return null;
        if (socket) {
            // re-join rooms if user changed
            if (user?._id) socket.emit('joinRoom', user._id);
            if (user?.role === 'admin') socket.emit('joinAdmin');
            return socket;
        }

        const base = API_BASE_URL.replace(/\/+$/, '');
        socket = io(base, { transports: ['websocket'] });

        socket.on('connect', () => {
            console.log('🔌 Socket connected:', socket.id);
            if (user?._id) socket.emit('joinRoom', user._id);
            if (user?.role === 'admin') socket.emit('joinAdmin');
        });

        socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
        });

        return socket;
    } catch (e) {
        console.warn('Socket init failed', e);
        return null;
    }
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        try { socket.disconnect(); } catch (_) {}
        socket = null;
    }
};

export default { initializeSocket, getSocket, disconnectSocket };
