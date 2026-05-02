import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { API_BASE_URL } from '../../api/axios';
import colors from '../../styles/colors';

export default function ManageFoods({ navigation }) {
    const [foods, setFoods] = useState([]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', fetchFoods);
        return unsubscribe;
    }, [navigation]);

    const fetchFoods = async () => {
        try { const res = await api.get('/api/foods'); setFoods(res.data.data || []); }
        catch (e) { console.error(e); }
    };

    const handleDelete = (id, name) => {
        Alert.alert('Delete Food', `Delete "${name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try { await api.delete(`/api/foods/${id}`); fetchFoods(); }
                    catch (e) { Alert.alert('Error', 'Failed to delete'); }
                },
            },
        ]);
    };

    const toggleAvailability = async (id, currentStatus) => {
        try {
            await api.put(`/api/foods/${id}`, { isAvailable: !currentStatus });
            fetchFoods();
        } catch (e) { Alert.alert('Error', 'Failed to update'); }
    };

    const renderFood = ({ item }) => (
        <View style={styles.foodCard}>
            <View style={styles.foodImageWrap}>
                {item.image ? (
                    <Image source={{ uri: `${API_BASE_URL}${item.image}` }} style={styles.foodImage} />
                ) : (
                    <View style={styles.foodPlaceholder}><Ionicons name="restaurant" size={24} color={colors.textMuted} /></View>
                )}
            </View>
            <View style={styles.foodInfo}>
                <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.foodPrice}>Rs. {item.price}</Text>
                <View style={styles.foodMeta}>
                    <TouchableOpacity
                        style={[styles.availBadge, { backgroundColor: item.isAvailable ? 'rgba(0,214,143,0.15)' : 'rgba(255,61,113,0.15)' }]}
                        onPress={() => toggleAvailability(item._id, item.isAvailable)}
                    >
                        <Text style={{ color: item.isAvailable ? colors.success : colors.danger, fontSize: 11, fontWeight: '600' }}>
                            {item.isAvailable ? 'Available' : 'Unavailable'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('AddEditFood', { food: item })}>
                    <Ionicons name="create-outline" size={18} color={colors.info} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item._id, item.name)}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Manage Foods</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddEditFood')}>
                    <Ionicons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>
            <FlatList
                data={foods}
                keyExtractor={(item) => item._id}
                renderItem={renderFood}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10,
    },
    title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    addButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 8 },
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    foodCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassBg,
        borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 16,
        padding: 12, marginBottom: 10,
    },
    foodImageWrap: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden' },
    foodImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    foodPlaceholder: {
        width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
        backgroundColor: colors.backgroundElevated,
    },
    foodInfo: { flex: 1, marginLeft: 12 },
    foodName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    foodPrice: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
    foodMeta: { flexDirection: 'row', marginTop: 4 },
    availBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    actions: { flexDirection: 'row', gap: 8 },
    editBtn: { backgroundColor: 'rgba(0,149,255,0.1)', padding: 8, borderRadius: 10 },
    deleteBtn: { backgroundColor: 'rgba(255,61,113,0.1)', padding: 8, borderRadius: 10 },
});
