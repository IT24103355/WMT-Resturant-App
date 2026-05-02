import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extractHost = (value) => {
    if (!value || typeof value !== 'string') {
        return null;
    }

    // Handles values like "172.20.10.2:8081" or "exp://172.20.10.2:8081".
    const cleaned = value.replace(/^[a-zA-Z]+:\/\//, '');
    const host = cleaned.split('/')[0].split(':')[0];
    return host || null;
};

const getApiBaseUrl = () => {
    const envUrl = process.env.EXPO_PUBLIC_API_URL;
    if (envUrl) {
        return envUrl;
    }

    const hostUri =
        Constants.expoConfig?.hostUri ||
        Constants.expoConfig?.extra?.expoGo?.debuggerHost ||
        Constants.manifest2?.extra?.expoClient?.hostUri ||
        Constants.manifest?.debuggerHost;

    const hostCandidates = [
        hostUri,
        Constants.linkingUri,
        Constants.experienceUrl,
    ];

    // In Expo Go, localhost points to the phone, not this Mac.
    for (const candidate of hostCandidates) {
        const host = extractHost(candidate);
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
            return `http://${host}:5001`;
        }
    }

    // Android emulator can access host machine via 10.0.2.2.
    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:5001';
    }

    return 'http://localhost:5001';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15001,
});

// Request interceptor - attach JWT token
api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Let axios/browser set multipart boundaries automatically for FormData uploads.
        if (config.data instanceof FormData && config.headers) {
            delete config.headers['Content-Type'];
            delete config.headers.common?.['Content-Type'];
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
        }
        return Promise.reject(error);
    }
);

export { API_BASE_URL };
export default api;
