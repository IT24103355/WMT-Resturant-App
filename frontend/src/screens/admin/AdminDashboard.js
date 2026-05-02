import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../api/axios';
import colors from '../../styles/colors';

export default function AdminDashboard({ navigation }) {
    const [stats, setStats] = useState({
        orders: 0,
        revenue: 0,
        foods: 0,
        users: 0,
        riders: 0,
        activeOrders: 0,
        dailyRevenue: 0,
        pendingPayments: 0,
        successfulTransactions: 0,
        refundRequests: 0,
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => { fetchDashboard(); }, []);

    const fetchDashboard = async () => {
        try {
            const [ordersRes, foodsRes, usersRes, paymentsRes] = await Promise.all([
                api.get('/api/orders/all'),
                api.get('/api/foods'),
                api.get('/api/users'),
                api.get('/api/payments/admin/analytics'),
            ]);
            const users = usersRes.data.data || [];
            const riders = users.filter((user) => user.role === 'rider').length;
            const activeOrders = (ordersRes.data.data || []).filter((order) => ['confirmed', 'preparing', 'ready'].includes(order.status)).length;
            const paymentStats = paymentsRes?.data?.data || {};

            setStats({
                orders: ordersRes.data.count || 0,
                revenue: ordersRes.data.totalRevenue || 0,
                foods: foodsRes.data.count || 0,
                users: users.length || 0,
                riders,
                activeOrders,
                dailyRevenue: paymentStats.dailyRevenue || 0,
                pendingPayments: paymentStats.pendingPayments || 0,
                successfulTransactions: paymentStats.successfulTransactions || 0,
                refundRequests: paymentStats.refundRequests || 0,
            });
            setRecentOrders((ordersRes.data.data || []).slice(0, 5));
        } catch (e) { console.error(e); }
    };

    const onRefresh = async () => { setRefreshing(true); await fetchDashboard(); setRefreshing(false); };

    const statCards = [
        { label: 'Total Orders', value: stats.orders, icon: 'receipt', gradient: colors.gradientPrimary },
        { label: 'Revenue', value: `Rs.${stats.revenue.toFixed(0)}`, icon: 'cash', gradient: colors.gradientGold },
        { label: 'Users', value: stats.users, icon: 'people', gradient: colors.gradientSuccess },
        { label: 'Riders', value: stats.riders, icon: 'bicycle', gradient: ['#0095FF', '#0077CC'] },
    ];

    const quickActions = [
        { label: 'Add Food', icon: 'add-circle', screen: 'AddEditFood', color: colors.primary },
        { label: 'Category', icon: 'grid', screen: 'ManageCategories', color: colors.secondary },
        { label: 'Users', icon: 'people', screen: 'ManageUsers', color: colors.info },
        { label: 'Promotion', icon: 'pricetag', screen: 'ManagePromotions', color: colors.success },
    ];

    const statusColors = { pending: colors.pending, confirmed: colors.confirmed, preparing: colors.preparing, ready: colors.ready, delivered: colors.delivered, cancelled: colors.cancelled };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
                <View style={styles.header}>
                    <Text style={styles.title}>Dashboard</Text>
                    <Text style={styles.subtitle}>Dine Wave Admin</Text>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {statCards.map((card, index) => (
                        <View key={index} style={styles.statCardWrap}>
                            <LinearGradient colors={card.gradient} style={styles.statCard}>
                                <Ionicons name={card.icon} size={24} color="rgba(255,255,255,0.8)" />
                                <Text style={styles.statValue}>{card.value}</Text>
                                <Text style={styles.statLabel}>{card.label}</Text>
                            </LinearGradient>
                        </View>
                    ))}
                </View>

                <View style={styles.healthPanel}>
                    <View style={styles.healthItem}>
                        <Text style={styles.healthValue}>{stats.activeOrders}</Text>
                        <Text style={styles.healthLabel}>Active Orders</Text>
                    </View>
                    <View style={styles.healthDivider} />
                    <View style={styles.healthItem}>
                        <Text style={styles.healthValue}>{stats.foods}</Text>
                        <Text style={styles.healthLabel}>Menu Items</Text>
                    </View>
                    <View style={styles.healthDivider} />
                    <View style={styles.healthItem}>
                        <Text style={styles.healthValue}>{stats.revenue > 0 ? 'Live' : 'Idle'}</Text>
                        <Text style={styles.healthLabel}>Sales Engine</Text>
                    </View>
                </View>

                <View style={styles.healthPanel}>
                    <View style={styles.healthItem}>
                        <Text style={styles.healthValue}>Rs.{stats.dailyRevenue.toFixed(0)}</Text>
                        <Text style={styles.healthLabel}>Daily Revenue</Text>
                    </View>
                    <View style={styles.healthDivider} />
                    <View style={styles.healthItem}>
                        <Text style={styles.healthValue}>{stats.pendingPayments}</Text>
                        <Text style={styles.healthLabel}>Pending Payments</Text>
                    </View>
                    <View style={styles.healthDivider} />
                    <View style={styles.healthItem}>
                        <Text style={styles.healthValue}>{stats.successfulTransactions}</Text>
                        <Text style={styles.healthLabel}>Successful Txns</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsRow}>
                    {quickActions.map((action, index) => (
                        <TouchableOpacity key={index} style={styles.actionCard} onPress={() => navigation.navigate(action.screen)}>
                            <View style={[styles.actionIcon, { backgroundColor: `${action.color}20` }]}>
                                <Ionicons name={action.icon} size={24} color={action.color} />
                            </View>
                            <Text style={styles.actionLabel}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Recent Orders */}
                <Text style={styles.sectionTitle}>Recent Orders</Text>
                {recentOrders.map((order) => (
                    <View key={order._id} style={styles.orderItem}>
                        <View style={styles.orderInfo}>
                            <Text style={styles.orderCustomer}>{order.user?.name || 'Customer'}</Text>
                            <Text style={styles.orderTime}>{new Date(order.createdAt).toLocaleString()}</Text>
                        </View>
                        <View style={[styles.statusDot, { backgroundColor: statusColors[order.status] || colors.pending }]}>
                            <Text style={styles.statusDotText}>{order.status}</Text>
                        </View>
                        <Text style={styles.orderAmount}>Rs.{order.totalAmount.toFixed(0)}</Text>
                    </View>
                ))}
                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingTop: 10 },
    title: { fontSize: 30, fontWeight: '900', color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 20 },
    statCardWrap: { width: '50%', padding: 6 },
    statCard: { borderRadius: 18, padding: 18, minHeight: 110 },
    statValue: { fontSize: 26, fontWeight: '900', color: '#FFF', marginTop: 8 },
    statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: 20, marginTop: 24, marginBottom: 14 },
    healthPanel: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 18,
        paddingVertical: 16,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
    },
    healthItem: { flex: 1, alignItems: 'center' },
    healthValue: { fontSize: 18, fontWeight: '900', color: colors.textPrimary },
    healthLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
    healthDivider: { width: 1, height: 34, backgroundColor: colors.glassBorder },
    actionsRow: { flexDirection: 'row', flexWrap: 'nowrap', paddingHorizontal: 12, gap: 8 },
    actionCard: {
        width: '23%',
        alignItems: 'center',
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 8,
    },
    actionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    actionLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', textAlign: 'center', lineHeight: 12 },
    orderItem: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassBg,
        borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 14,
        padding: 14, marginHorizontal: 16, marginBottom: 8,
    },
    orderInfo: { flex: 1 },
    orderCustomer: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    orderTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    statusDot: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 10 },
    statusDotText: { color: '#FFF', fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
    orderAmount: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
