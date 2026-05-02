import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../api/axios';
import colors from '../../styles/colors';

export default function ManagePromotions({ navigation }) {
    const [promotions, setPromotions] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [discount, setDiscount] = useState('');
    const [code, setCode] = useState('');
    const [validFrom, setValidFrom] = useState('');
    const [validUntil, setValidUntil] = useState('');

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }

        navigation.navigate('AdminMain', { screen: 'Dashboard' });
    };

    useEffect(() => { fetchPromotions(); }, []);

    const fetchPromotions = async () => {
        try { const res = await api.get('/api/promotions/all'); setPromotions(res.data.data || []); }
        catch (e) { console.error(e); }
    };

    const handleSubmit = async () => {
        if (!title || !discount || !validFrom || !validUntil) {
            Alert.alert('Error', 'Please fill required fields');
            return;
        }
        try {
            await api.post('/api/promotions', {
                title, description, discountPercentage: parseFloat(discount),
                code: code || `LAGOON${Date.now()}`,
                validFrom: new Date(validFrom), validUntil: new Date(validUntil),
            });
            setTitle(''); setDescription(''); setDiscount(''); setCode('');
            setValidFrom(''); setValidUntil(''); setShowForm(false);
            fetchPromotions();
            Alert.alert('Success', 'Promotion created!');
        } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed to create'); }
    };

    const handleDelete = (id) => {
        Alert.alert('Delete', 'Delete this promotion?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try { await api.delete(`/api/promotions/${id}`); fetchPromotions(); }
                    catch (e) { Alert.alert('Error', 'Failed to delete'); }
                }
            },
        ]);
    };

    const toggleActive = async (id, isActive) => {
        try { await api.put(`/api/promotions/${id}`, { isActive: !isActive }); fetchPromotions(); }
        catch (e) { Alert.alert('Error', 'Failed to update'); }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Promotions</Text>
                <TouchableOpacity onPress={() => setShowForm(!showForm)}>
                    <Ionicons name={showForm ? 'close' : 'add'} size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {showForm && (
                <View style={styles.form}>
                    <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title *" placeholderTextColor={colors.textMuted} />
                    <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={colors.textMuted} />
                    <TextInput style={styles.input} value={discount} onChangeText={setDiscount} placeholder="Discount % *" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                    <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="Promo Code" placeholderTextColor={colors.textMuted} autoCapitalize="characters" />
                    <TextInput style={styles.input} value={validFrom} onChangeText={setValidFrom} placeholder="Valid From (YYYY-MM-DD) *" placeholderTextColor={colors.textMuted} />
                    <TextInput style={styles.input} value={validUntil} onChangeText={setValidUntil} placeholder="Valid Until (YYYY-MM-DD) *" placeholderTextColor={colors.textMuted} />
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
                        <LinearGradient colors={colors.gradientPrimary} style={styles.saveGradient}>
                            <Text style={styles.saveBtnText}>Create Promotion</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            <FlatList
                data={promotions}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <View style={styles.promoCard}>
                        <View style={styles.promoTop}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.promoTitle}>{item.title}</Text>
                                <Text style={styles.promoDiscount}>{item.discountPercentage}% OFF • {item.code}</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.activeBadge, { backgroundColor: item.isActive ? 'rgba(0,214,143,0.15)' : 'rgba(255,61,113,0.15)' }]}
                                onPress={() => toggleActive(item._id, item.isActive)}
                            >
                                <Text style={{ color: item.isActive ? colors.success : colors.danger, fontSize: 10, fontWeight: '600' }}>
                                    {item.isActive ? 'Active' : 'Inactive'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.promoValidity}>
                            {new Date(item.validFrom).toLocaleDateString()} - {new Date(item.validUntil).toLocaleDateString()}
                        </Text>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item._id)}>
                            <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        </TouchableOpacity>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
    title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    form: { paddingHorizontal: 20, marginBottom: 10 },
    input: { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 12, padding: 14, color: colors.textPrimary, fontSize: 14, marginBottom: 8 },
    saveBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
    saveGradient: { paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontWeight: '700' },
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    promoCard: { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 14, padding: 14, marginBottom: 10 },
    promoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    promoTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    promoDiscount: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
    activeBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
    promoValidity: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
    deleteBtn: { position: 'absolute', bottom: 14, right: 14, padding: 4 },
});
