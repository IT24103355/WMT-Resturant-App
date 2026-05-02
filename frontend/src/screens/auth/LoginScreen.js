import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, ImageBackground, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import colors from '../../styles/colors';

const { width } = Dimensions.get('window');

const HERO_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80';

export default function LoginScreen({ navigation }) {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        setLoading(true);
        const result = await login(email, password);
        setLoading(false);
        if (!result.success) {
            Alert.alert('Login Failed', result.message);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >
                <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.heroCard} imageStyle={styles.heroImageRadius}>
                    <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.68)']} style={styles.heroOverlay}>
                        <Ionicons name="sparkles" size={28} color="#FFFFFF" style={{ marginBottom: 12 }} />
                        <Text style={styles.heroBadge}>PREMIUM DINING</Text>
                        <Text style={styles.heroTitle}>Signature Experience</Text>
                        <Text style={styles.heroSubtitle}>Login to track orders, save favorites, and unlock exclusive menu drops.</Text>
                    </LinearGradient>
                </ImageBackground>

                <View style={styles.header}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="restaurant" size={34} color="#FFFFFF" />
                        </View>
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Welcome back! Sign in to continue</Text>
                    </View>

                    {/* Form Card */}
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Sign In</Text>

                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor={colors.textMuted}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!loading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor={colors.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCorrect={false}
                                editable={!loading}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.loginButton, loading && styles.buttonDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            <LinearGradient colors={colors.gradientPrimary} style={styles.buttonGradient}>
                                <Text style={styles.loginButtonText}>{loading ? 'Signing In...' : 'Sign In'}</Text>
                                {!loading && <Ionicons name="arrow-forward" size={20} color="#FFF" />}
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity style={styles.registerButton} onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.registerText}>
                                Don't have an account?{' '}
                                <Text style={styles.registerHighlight}>Sign Up</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        );
}

const styles = StyleSheet.create({
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20, paddingHorizontal: 20 },
    heroCard: {
        width: '100%', height: 240, borderRadius: 24, marginBottom: 24,
        overflow: 'hidden', backgroundColor: colors.backgroundElevated,
    },
    heroImageRadius: { borderRadius: 24 },
    heroOverlay: {
        flex: 1, paddingHorizontal: 24, paddingVertical: 32,
        justifyContent: 'center', alignItems: 'center',
    },
    heroBadge: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
    heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 8, textAlign: 'center' },
    heroSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 18, marginTop: 12, textAlign: 'center' },
    header: { alignItems: 'center', marginBottom: 24 },
    iconCircle: {
        width: 68, height: 68, borderRadius: 34,
        backgroundColor: colors.primary,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 16,
    },
    title: { fontSize: 32, fontWeight: '900', color: colors.textPrimary, letterSpacing: 0.3 },
    subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 6 },
    formCard: {
        backgroundColor: '#FFFFFF', borderWidth: 1,
        borderColor: '#E9D9DE', borderRadius: 24, padding: 24,
        shadowColor: '#200710',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
        elevation: 8,
    },
    formTitle: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 20 },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FAF7F8', borderWidth: 1,
        borderColor: '#E6DCE0', borderRadius: 14,
        paddingHorizontal: 16, marginBottom: 16, height: 54,
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, color: colors.textPrimary, fontSize: 16 },
    loginButton: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
    buttonGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, gap: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    loginButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#E5DADD' },
    dividerText: { color: colors.textMuted, marginHorizontal: 12, fontSize: 12 },
    registerButton: { alignItems: 'center' },
    registerText: { color: colors.textSecondary, fontSize: 14 },
    registerHighlight: { color: colors.primary, fontWeight: '700' },
});
