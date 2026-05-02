import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../api/axios';
import colors from '../../styles/colors';

export default function ManageUsers({ navigation }) {
    const [users, setUsers] = useState([]);

    const roleStyles = {
        admin: { bg: 'rgba(255,215,0,0.15)', fg: colors.gold },
        rider: { bg: 'rgba(37,99,235,0.15)', fg: colors.info },
        customer: { bg: 'rgba(255,107,53,0.15)', fg: colors.primary },
    };

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }

        navigation.navigate('AdminMain', { screen: 'Dashboard' });
    };

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        try { const res = await api.get('/api/users'); setUsers(res.data.data || []); }
        catch (e) { console.error(e); }
    };

    const toggleRole = async (id, currentRole) => {
        const options = ['customer', 'rider', 'admin'].filter((role) => role !== currentRole);
        Alert.alert('Change Role', 'Select a new role', [
            ...options.map((role) => ({
                text: role.charAt(0).toUpperCase() + role.slice(1),
                onPress: async () => {
                    try { await api.put(`/api/users/${id}`, { role }); fetchUsers(); }
                    catch (e) { Alert.alert('Error', 'Failed to update'); }
                },
            })),
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const toggleActive = async (id, isActive) => {
        try { await api.put(`/api/users/${id}`, { isActive: !isActive }); fetchUsers(); }
        catch (e) { Alert.alert('Error', 'Failed to update'); }
    };

    const handleDelete = (id) => {
        Alert.alert('Delete User', 'This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try { await api.delete(`/api/users/${id}`); fetchUsers(); }
                    catch (e) { Alert.alert('Error', 'Failed to delete'); }
                }
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Manage Users</Text>
                <Text style={styles.count}>{users.length}</Text>
            </View>

            <FlatList
                data={users}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <View style={styles.userCard}>
                        <View style={[styles.avatar, { backgroundColor: roleStyles[item.role]?.bg || roleStyles.customer.bg }]}> 
                            <Text style={[styles.avatarText, { color: roleStyles[item.role]?.fg || roleStyles.customer.fg }]}> 
                                {item.name?.[0]?.toUpperCase() || 'U'}
                            </Text>
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{item.name}</Text>
                            <Text style={styles.userEmail}>{item.email}</Text>
                            <View style={styles.userMeta}>
                                <View style={[styles.roleBadge, { backgroundColor: roleStyles[item.role]?.bg || roleStyles.customer.bg }]}> 
                                    <Text style={[styles.roleText, { color: roleStyles[item.role]?.fg || roleStyles.customer.fg }]}>{item.role}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: item.isActive ? 'rgba(0,214,143,0.15)' : 'rgba(255,61,113,0.15)' }]}>
                                    <Text style={{ color: item.isActive ? colors.success : colors.danger, fontSize: 10, fontWeight: '600' }}>
                                        {item.isActive ? 'Active' : 'Inactive'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => toggleRole(item._id, item.role)}>
                                <Ionicons name="shield-outline" size={16} color={colors.info} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => toggleActive(item._id, item.isActive)}>
                                <Ionicons name={item.isActive ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.warning} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item._id)}>
                                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
    title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    count: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 16, padding: 14, marginBottom: 10 },
    avatar: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { fontSize: 18, fontWeight: '700' },
    userInfo: { flex: 1 },
    userName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    userEmail: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    userMeta: { flexDirection: 'row', gap: 6, marginTop: 6 },
    roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    roleText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    actions: { flexDirection: 'row', gap: 4 },
    actionBtn: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 6, borderRadius: 8 },
});
