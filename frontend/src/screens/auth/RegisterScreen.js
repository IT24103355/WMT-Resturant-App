import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import colors from '../../styles/colors';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1400&q=80';

export default function RegisterScreen({ navigation }) {
    const { register } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }

        navigation.navigate('Login');
    };

    const handleRegister = async () => {
        if (!name || !email || !password || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }
        setLoading(true);
        const result = await register(name, email, password, phone);
        setLoading(false);
        if (!result.success) {
            Alert.alert('Registration Failed', result.message);
        }
    };

    return (
        <LinearGradient colors={['#5A1220', '#7A1E2C', '#9A2A3A']} style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.heroImage} imageStyle={styles.heroImageRadius}>
                        <LinearGradient colors={['rgba(12,12,12,0.1)', 'rgba(16,16,16,0.68)']} style={styles.heroOverlay}>
                            <View style={styles.badgeRow}>
                                <Text style={styles.heroBadge}>NEW MEMBER</Text>
                            </View>
                            <Text style={styles.heroTitle}>Create Your{`\n`}Food Journey</Text>
                            <Text style={styles.heroSubtitle}>Save favorites, order faster, and unlock member-only offers.</Text>
                        </LinearGradient>
                    </ImageBackground>

                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Join Dine Wave family today!</Text>
                    </View>

                    <View style={styles.formCard}>
                        {[
                            { icon: 'person-outline', placeholder: 'Full Name', value: name, setter: setName },
                            { icon: 'mail-outline', placeholder: 'Email Address', value: email, setter: setEmail, keyboard: 'email-address' },
                            { icon: 'call-outline', placeholder: 'Phone Number (Optional)', value: phone, setter: setPhone, keyboard: 'phone-pad' },
                        ].map((field, index) => (
                            <View key={index} style={styles.inputContainer}>
                                <Ionicons name={field.icon} size={20} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder={field.placeholder}
                                    placeholderTextColor={colors.textMuted}
                                    value={field.value}
                                    onChangeText={field.setter}
                                    keyboardType={field.keyboard || 'default'}
                                    autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'words'}
                                    autoCorrect={field.keyboard === 'email-address' ? false : true}
                                    editable={!loading}
                                />
                            </View>
                        ))}

                        {[
                            { placeholder: 'Password', value: password, setter: setPassword },
                            { placeholder: 'Confirm Password', value: confirmPassword, setter: setConfirmPassword },
                        ].map((field, index) => (
                            <View key={`pw-${index}`} style={styles.inputContainer}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder={field.placeholder}
                                    placeholderTextColor={colors.textMuted}
                                    value={field.value}
                                    onChangeText={field.setter}
                                    secureTextEntry={!showPassword}
                                    autoCorrect={false}
                                    editable={!loading}
                                />
                                {index === 0 && (
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}

                        <TouchableOpacity style={[styles.registerBtn, loading && { opacity: 0.6 }]} onPress={handleRegister} disabled={loading}>
                            <LinearGradient colors={colors.gradientPrimary} style={styles.buttonGradient}>
                                <Text style={styles.registerBtnText}>{loading ? 'Creating Account...' : 'Sign Up'}</Text>
                                {!loading && <Ionicons name="arrow-forward" size={20} color="#FFF" />}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.loginText}>
                                Already have an account? <Text style={styles.loginHighlight}>Sign In</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    heroImage: { height: 210, borderRadius: 26, overflow: 'hidden', marginBottom: 18 },
    heroImageRadius: { borderRadius: 26 },
    heroOverlay: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 18 },
    badgeRow: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
    heroBadge: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    heroTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', lineHeight: 29 },
    heroSubtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 8, fontSize: 13, lineHeight: 18 },
    header: { marginBottom: 18 },
    backButton: { marginBottom: 12, alignSelf: 'flex-start' },
    title: { fontSize: 34, fontWeight: '900', color: '#FFFFFF' },
    subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
    formCard: {
        backgroundColor: '#FFFFFF', borderWidth: 1,
        borderColor: '#E9D9DE', borderRadius: 28, padding: 24,
        shadowColor: '#200710',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 22,
        elevation: 8,
    },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FAF7F8', borderWidth: 1,
        borderColor: '#E6DCE0', borderRadius: 14,
        paddingHorizontal: 16, marginBottom: 14, height: 54,
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, color: colors.textPrimary, fontSize: 15 },
    registerBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
    buttonGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, gap: 8,
    },
    registerBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    loginLink: { alignItems: 'center', marginTop: 20 },
    loginText: { color: colors.textSecondary, fontSize: 14 },
    loginHighlight: { color: colors.primary, fontWeight: '700' },
});
