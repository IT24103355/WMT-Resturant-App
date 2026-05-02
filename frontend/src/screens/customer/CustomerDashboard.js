import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import colors from '../../styles/colors';

const uniqueValues = (values) => [...new Set(values.filter(Boolean))];

const countByValue = (items, getValue) => {
    const counts = {};
    items.forEach((item) => {
        const value = getValue(item);
        if (!value) return;
        counts[value] = (counts[value] || 0) + 1;
    });
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count }));
};

const getInitials = (name) => {
    if (!name) return 'U';
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
};

export default function CustomerDashboard({ navigation }) {
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchDashboard();
        } else {
            setOrders([]);
            setLoading(false);
        }
    }, [user]);

    const fetchDashboard = async () => {
        try {
            const res = await api.get('/api/orders');
            setOrders(res.data.data || []);
        } catch (error) {
            console.error('Dashboard fetch failed:', error);
            setOrders([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchDashboard();
    };

    const dashboardData = useMemo(() => {
        const recentOrders = orders.slice(0, 3);
        const savedAddresses = uniqueValues([
            user?.address,
            ...orders.map((order) => order.deliveryAddress),
        ]).slice(0, 4);

        const favoriteFoods = countByValue(
            orders.flatMap((order) => order.items || []),
            (item) => item.name || item.food?.name
        ).slice(0, 4);

        const paymentMethods = countByValue(orders, (order) => order.paymentMethod).slice(0, 3);
        const notifications = recentOrders.map((order) => ({
            title: `Order #${order._id.slice(-6).toUpperCase()}`,
            text: `Status updated to ${order.status}`,
            icon: order.status === 'delivered' ? 'checkmark-done-circle' : 'notifications-outline',
        }));

        return {
            recentOrders,
            savedAddresses,
            favoriteFoods,
            paymentMethods,
            notifications,
            stats: [
                { label: 'Orders', value: orders.length, icon: 'receipt-outline' },
                { label: 'Saved Addresses', value: savedAddresses.length, icon: 'location-outline' },
                { label: 'Favorites', value: favoriteFoods.length, icon: 'heart-outline' },
                { label: 'Payment Methods', value: paymentMethods.length, icon: 'card-outline' },
            ],
        };
    }, [orders, user?.address]);

    const quickActions = [
        { label: 'Edit Profile', icon: 'person-circle-outline', screen: 'CustomerProfile' },
        { label: 'Browse Menu', icon: 'restaurant-outline', screen: 'Menu' },
        { label: 'My Orders', icon: 'receipt-outline', screen: 'Orders' },
        { label: 'Promotions', icon: 'pricetag-outline', screen: 'Promotions' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                <View style={styles.hero}>
                    <LinearGradient colors={colors.gradientPrimary} style={styles.heroGradient}>
                        <View style={styles.heroTopRow}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
                            </View>
                            <View style={styles.roleBadge}>
                                <Ionicons name="grid-outline" size={12} color="#FFF" />
                                <Text style={styles.roleText}>Customer Control Center</Text>
                            </View>
                        </View>
                        <Text style={styles.heroTitle}>Welcome back, {user?.name?.split(' ')[0] || 'Guest'}</Text>
                        <Text style={styles.heroSubtitle}>Manage addresses, orders, payments, favorites, and notifications in one place.</Text>
                        <View style={styles.heroActionsRow}>
                            <TouchableOpacity style={styles.heroAction} onPress={() => navigation.navigate('CustomerProfile')}>
                                <Ionicons name="person-outline" size={16} color="#FFF" />
                                <Text style={styles.heroActionText}>Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.heroAction} onPress={() => navigation.navigate('Orders')}>
                                <Ionicons name="receipt-outline" size={16} color="#FFF" />
                                <Text style={styles.heroActionText}>Orders</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                <View style={styles.statsGrid}>
                    {dashboardData.stats.map((stat) => (
                        <View key={stat.label} style={styles.statCardWrap}>
                            <View style={styles.statCard}>
                                <View style={styles.statIcon}>
                                    <Ionicons name={stat.icon} size={20} color={colors.primary} />
                                </View>
                                <Text style={styles.statValue}>{stat.value}</Text>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <Text style={styles.sectionHint}>Shortcuts</Text>
                    </View>
                    <View style={styles.actionGrid}>
                        {quickActions.map((action) => (
                            <TouchableOpacity key={action.label} style={styles.actionCard} onPress={() => navigation.navigate(action.screen)}>
                                <View style={styles.actionIconWrap}>
                                    <Ionicons name={action.icon} size={22} color={colors.primary} />
                                </View>
                                <Text style={styles.actionLabel}>{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Saved Addresses</Text>
                        <Text style={styles.sectionHint}>{dashboardData.savedAddresses.length} saved</Text>
                    </View>
                    {dashboardData.savedAddresses.length > 0 ? dashboardData.savedAddresses.map((address, index) => (
                        <View key={`${address}-${index}`} style={styles.listRow}>
                            <Ionicons name="location-outline" size={18} color={colors.primary} />
                            <Text style={styles.listText}>{address}</Text>
                        </View>
                    )) : (
                        <Text style={styles.emptyText}>No saved addresses yet. Add one from your profile or during checkout.</Text>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Orders</Text>
                        <Text style={styles.sectionHint}>{dashboardData.recentOrders.length} recent</Text>
                    </View>
                    {dashboardData.recentOrders.length > 0 ? dashboardData.recentOrders.map((order) => (
                        <View key={order._id} style={styles.orderRow}>
                            <View style={styles.orderLeft}>
                                <Text style={styles.orderTitle}>Order #{order._id.slice(-6).toUpperCase()}</Text>
                                <Text style={styles.orderMeta}>{new Date(order.createdAt).toLocaleDateString()}</Text>
                            </View>
                            <View style={styles.orderRight}>
                                <Text style={styles.orderStatus}>{order.status}</Text>
                                <Text style={styles.orderAmount}>Rs. {order.totalAmount.toFixed(0)}</Text>
                            </View>
                        </View>
                    )) : (
                        <Text style={styles.emptyText}>{loading ? 'Loading orders...' : 'No recent orders yet.'}</Text>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Favorite Foods</Text>
                        <Text style={styles.sectionHint}>Based on your orders</Text>
                    </View>
                    {dashboardData.favoriteFoods.length > 0 ? dashboardData.favoriteFoods.map((item) => (
                        <View key={item.label} style={styles.favoriteRow}>
                            <View style={styles.favoriteBullet} />
                            <Text style={styles.listText}>{item.label}</Text>
                            <Text style={styles.favoriteCount}>{item.count}x</Text>
                        </View>
                    )) : (
                        <Text style={styles.emptyText}>Your favorite foods will appear here after a few orders.</Text>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Payment Methods</Text>
                        <Text style={styles.sectionHint}>Used in checkout</Text>
                    </View>
                    {dashboardData.paymentMethods.length > 0 ? dashboardData.paymentMethods.map((item) => (
                        <View key={item.label} style={styles.paymentRow}>
                            <Ionicons name="card-outline" size={18} color={colors.primary} />
                            <Text style={styles.listText}>{item.label}</Text>
                            <Text style={styles.paymentCount}>{item.count}</Text>
                        </View>
                    )) : (
                        <Text style={styles.emptyText}>No payment history yet.</Text>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Notifications</Text>
                        <Text style={styles.sectionHint}>{dashboardData.notifications.length} new</Text>
                    </View>
                    {dashboardData.notifications.length > 0 ? dashboardData.notifications.map((notification) => (
                        <View key={notification.title} style={styles.notificationRow}>
                            <View style={styles.notificationIconWrap}>
                                <Ionicons name={notification.icon} size={18} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.notificationTitle}>{notification.title}</Text>
                                <Text style={styles.notificationText}>{notification.text}</Text>
                            </View>
                        </View>
                    )) : (
                        <Text style={styles.emptyText}>Your latest updates and delivery alerts will show here.</Text>
                    )}
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    hero: { paddingHorizontal: 16, paddingTop: 10 },
    heroGradient: { borderRadius: 24, padding: 18 },
    heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.16)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { color: '#FFF', fontWeight: '900', fontSize: 22 },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.14)',
    },
    roleText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    heroTitle: { color: '#FFF', fontSize: 26, fontWeight: '900', marginTop: 18, lineHeight: 32 },
    heroSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19, marginTop: 8 },
    heroActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    heroAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    heroActionText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 6 },
    statCardWrap: { width: '50%', padding: 6 },
    statCard: {
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 18,
        padding: 16,
        minHeight: 104,
    },
    statIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(122,30,44,0.08)', justifyContent: 'center', alignItems: 'center' },
    statValue: { fontSize: 23, fontWeight: '900', color: colors.textPrimary, marginTop: 12 },
    statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    section: {
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 20,
        padding: 16,
        marginHorizontal: 16,
        marginTop: 16,
    },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
    sectionHint: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    actionCard: {
        width: '48%',
        backgroundColor: 'rgba(122,30,44,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(122,30,44,0.12)',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    actionIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    actionLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
    listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.glassBorder },
    listText: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
    emptyText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
    orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.glassBorder },
    orderLeft: { flex: 1 },
    orderTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    orderMeta: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
    orderRight: { alignItems: 'flex-end', marginLeft: 12 },
    orderStatus: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'capitalize' },
    orderAmount: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginTop: 3 },
    favoriteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.glassBorder },
    favoriteBullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 10 },
    favoriteCount: { fontSize: 12, fontWeight: '700', color: colors.primary },
    paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.glassBorder },
    paymentCount: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    notificationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.glassBorder },
    notificationIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(122,30,44,0.08)', justifyContent: 'center', alignItems: 'center' },
    notificationTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    notificationText: { fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
});
