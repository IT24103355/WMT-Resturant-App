import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';
import { initializeSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStoredAuth();
    }, []);

    const loadStoredAuth = async () => {
        try {
            const storedToken = await AsyncStorage.getItem('token');
            const storedUser = await AsyncStorage.getItem('user');
            if (storedToken && storedUser) {
                setToken(storedToken);
                const parsed = JSON.parse(storedUser);
                setUser(parsed);
                // initialize socket for notifications
                try { initializeSocket(parsed); } catch (e) { console.warn('socket init error', e); }
            }
        } catch (error) {
            console.error('Error loading auth:', error);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const res = await api.post('/api/auth/login', { email, password });
            if (res.data.success) {
                const { token: newToken, ...userData } = res.data.data;
                await AsyncStorage.setItem('token', newToken);
                await AsyncStorage.setItem('user', JSON.stringify(userData));
                setToken(newToken);
                setUser(userData);
                    try { initializeSocket(userData); } catch (e) { console.warn('socket init error', e); }
                return { success: true };
            }
        } catch (error) {
            const isNetworkError = !error.response;
            return {
                success: false,
                message: isNetworkError
                    ? 'Cannot connect to server. Make sure backend is running and your phone and computer are on the same network.'
                    : error.response?.data?.message || 'Login failed',
            };
        }
    };

    const register = async (name, email, password, phone, avatar = '') => {
        try {
            const res = await api.post('/api/auth/register', { name, email, password, phone, avatar });
            if (res.data.success) {
                const { token: newToken, ...userData } = res.data.data;
                const normalizedUser = { ...userData, image: userData.image || userData.avatar || '' };
                await AsyncStorage.setItem('token', newToken);
                await AsyncStorage.setItem('user', JSON.stringify(normalizedUser));
                setToken(newToken);
                setUser(normalizedUser);
                    try { initializeSocket(normalizedUser); } catch (e) { console.warn('socket init error', e); }
                return { success: true };
            }
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Registration failed',
            };
        }
    };

    const logout = async () => {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        setToken(null);
        setUser(null);
        try { disconnectSocket(); } catch (e) { console.warn('socket disconnect', e); }
    };

    const updateUser = (updatedData) => {
        setUser((prev) => {
            const next = { ...prev, ...updatedData };
            if (!next.image && next.avatar) next.image = next.avatar;
            if (!next.avatar && next.image) next.avatar = next.image;
            AsyncStorage.setItem('user', JSON.stringify(next));
            return next;
        });
    };

    return (
        <AuthContext.Provider
            value={{ user, token, loading, login, register, logout, updateUser, isAdmin: user?.role === 'admin' }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
