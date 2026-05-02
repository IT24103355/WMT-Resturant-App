import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { API_BASE_URL } from '../../api/axios';
import { getSocket } from '../../services/socket';
import colors from '../../styles/colors';

const allStatuses = ['pending', 'confirmed', 'accepted', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'];
const statusLabels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    accepted: 'Accepted',
    preparing: 'Preparing',
    ready: 'Ready',
    picked_up: 'Picked Up',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};
const statusConfig = {
    pending: { icon: 'time', color: colors.pending },
    confirmed: { icon: 'checkmark-circle', color: colors.confirmed },
    accepted: { icon: 'checkmark-done-circle', color: colors.confirmed },
    preparing: { icon: 'restaurant', color: colors.preparing },
    ready: { icon: 'checkmark-done-circle', color: colors.ready },
    picked_up: { icon: 'bicycle', color: colors.info },
    out_for_delivery: { icon: 'navigate', color: colors.warning },
    delivered: { icon: 'bicycle', color: colors.delivered },
    cancelled: { icon: 'close-circle', color: colors.cancelled },
};

export default function ManageOrders() {
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [refundRequests, setRefundRequests] = useState([]);
    const [riders, setRiders] = useState([]);
    const [loadingImageByOrder, setLoadingImageByOrder] = useState({});

    const getOrderImageUri = (uri) => {
        if (!uri) return '';
        if (uri.startsWith('http') || uri.startsWith('file') || uri.startsWith('content') || uri.startsWith('ph')) {
            return uri;
        }
        return `${API_BASE_URL}${uri}`;
    };

    const getPackageImageUri = (order) => {
        if (order?.packageImageUrl) return order.packageImageUrl;
        return getOrderImageUri(order?.packageImage || '');
    };

    const isPdfAttachment = (uri) => String(uri || '').toLowerCase().endsWith('.pdf');

    useEffect(() => { fetchOrders(); }, [filter]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return undefined;

        const handleDeliveryUpdate = (payload) => {
            if (!payload?.orderId) return;
            setOrders((current) => current.map((order) => (
                String(order._id) === String(payload.orderId) ? { ...order, ...payload } : order
            )));
            if (payload.packageImage) {
                setLoadingImageByOrder((current) => ({ ...current, [payload.orderId]: false }));
            }
            fetchOrders();

            if (payload.status === 'delivered') {
                const shortId = payload.orderId.toString().slice(-6).toUpperCase();
                Alert.alert('Delivery Completed', `Order #${shortId} has been delivered.`);
            }
        };

        socket.on('deliveryAssignmentUpdate', handleDeliveryUpdate);

        return () => {
            try { socket.off('deliveryAssignmentUpdate', handleDeliveryUpdate); } catch (_) {}
        };
    }, []);

    const fetchOrders = async () => {
        try {
            let url = '/api/orders/all';
            if (filter) url += `?status=${filter}`;
            const [res, refundsRes, usersRes] = await Promise.all([
                api.get(url),
                api.get('/api/payments/admin/refund-requests'),
                api.get('/api/users'),
            ]);
            setOrders(res.data.data || []);
            setRefundRequests(refundsRes?.data?.data || []);
            setRiders((usersRes?.data?.data || []).filter((user) => user.role === 'rider' && user.isActive));
        } catch (e) { console.error(e); }
    };

    const onRefresh = async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false); };

    const updateStatus = (orderId, currentStatus) => {
        const nextStatuses = allStatuses.filter((s) => s !== currentStatus);
        Alert.alert('Update Status', 'Select new status', [
            ...nextStatuses.map((status) => ({
                text: status.charAt(0).toUpperCase() + status.slice(1),
                onPress: async () => {
                    try { await api.put(`/api/orders/${orderId}/status`, { status }); fetchOrders(); }
                    catch (e) { Alert.alert('Error', 'Failed to update'); }
                },
            })),
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const resolveRefund = (orderId) => {
        Alert.alert('Resolve Refund', 'Choose an action', [
            {
                text: 'Approve',
                onPress: async () => {
                    try { await api.put(`/api/payments/admin/refund-requests/${orderId}`, { action: 'approve' }); fetchOrders(); }
                    catch (e) { Alert.alert('Error', 'Could not approve refund request'); }
                },
            },
            {
                text: 'Mark Processed',
                onPress: async () => {
                    try { await api.put(`/api/payments/admin/refund-requests/${orderId}`, { action: 'process' }); fetchOrders(); }
                    catch (e) { Alert.alert('Error', 'Could not process refund request'); }
                },
            },
            {
                text: 'Reject',
                style: 'destructive',
                onPress: async () => {
                    try { await api.put(`/api/payments/admin/refund-requests/${orderId}`, { action: 'reject' }); fetchOrders(); }
                    catch (e) { Alert.alert('Error', 'Could not reject refund request'); }
                },
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const assignRider = (order) => {
        const options = [
            {
                text: 'Auto Assign Nearest',
                onPress: async () => {
                    try {
                        await api.put(`/api/orders/${order._id}/assign-rider`, { autoAssign: true });
                        fetchOrders();
                    } catch (e) {
                        Alert.alert('Error', e?.response?.data?.message || 'Auto assignment failed');
                    }
                },
            },
            ...riders.map((rider) => ({
                text: `Assign ${rider.name}`,
                onPress: async () => {
                    try {
                        await api.put(`/api/orders/${order._id}/assign-rider`, { riderId: rider._id, autoAssign: false });
                        fetchOrders();
                    } catch (e) {
                        Alert.alert('Error', e?.response?.data?.message || 'Manual assignment failed');
                    }
                },
            })),
            { text: 'Cancel', style: 'cancel' },
        ];

        Alert.alert('Assign Rider', 'Choose assignment method', options);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Orders</Text>
                <Text style={styles.count}>{orders.length}</Text>
            </View>

            <FlatList
                horizontal data={[{ _id: null, name: 'All' }, ...allStatuses.map((s) => ({ _id: s, name: s }))]}
                keyExtractor={(item) => item._id || 'all'}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterList}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.filterChip, filter === item._id && styles.filterActive]}
                        onPress={() => setFilter(item._id)}
                    >
                        <Text style={[styles.filterText, filter === item._id && { color: '#FFF' }]}>
                            {item._id ? (statusLabels[item._id] || item.name) : 'All'}
                        </Text>
                    </TouchableOpacity>
                )}
            />

            <FlatList
                ListHeaderComponent={
                    refundRequests.length ? (
                        <View style={styles.refundSection}>
                            <Text style={styles.refundHeading}>Pending Refund Requests</Text>
                            {refundRequests.slice(0, 5).map((req) => (
                                <View key={`refund-${req._id}`} style={styles.refundRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.refundOrder}>#{req._id.slice(-6).toUpperCase()} • {req.user?.name || 'Customer'}</Text>
                                        <Text style={styles.refundReason}>{req.refund?.reason || 'No reason provided'}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.refundActionBtn} onPress={() => resolveRefund(req._id)}>
                                        <Text style={styles.refundActionText}>Resolve</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    ) : null
                }
                data={orders}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                renderItem={({ item }) => {
                    const sc = statusConfig[item.status] || statusConfig.pending;
                    return (
                        <View style={styles.orderCard}>
                            <View style={styles.orderTop}>
                                <View>
                                    <Text style={styles.orderId}>#{item._id.slice(-6).toUpperCase()}</Text>
                                    <Text style={styles.orderCustomer}>{item.user?.name} • {item.user?.phone || 'No phone'}</Text>
                                    <Text style={styles.orderTime}>{new Date(item.createdAt).toLocaleString()}</Text>
                                </View>
                                <TouchableOpacity style={[styles.statusBtn, { backgroundColor: `${sc.color}20` }]} onPress={() => updateStatus(item._id, item.status)}>
                                    <Ionicons name={sc.icon} size={14} color={sc.color} />
                                    <Text style={[styles.statusText, { color: sc.color }]}>{statusLabels[item.status] || item.status}</Text>
                                    <Ionicons name="chevron-down" size={12} color={sc.color} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.divider} />
                            {item.items.map((orderItem, idx) => (
                                <Text key={idx} style={styles.itemLine}>{orderItem.quantity}x {orderItem.name || 'Item'} — Rs.{(orderItem.price * orderItem.quantity).toFixed(0)}</Text>
                            ))}
                            <View style={styles.orderBottom}>
                                <Text style={styles.specialNote}>{item.specialInstructions || ''}</Text>
                                <Text style={styles.orderTotal}>Rs. {item.totalAmount.toFixed(0)}</Text>
                            </View>
                            {item.specialRequestImages?.length > 0 && (
                                <View style={styles.specialImagesWrap}>
                                    <Text style={styles.specialImagesLabel}>Special Request Files ({item.specialRequestImages.length})</Text>
                                    <View style={styles.specialImagesRow}>
                                        {item.specialRequestImages.slice(0, 4).map((uri) => (
                                            isPdfAttachment(uri) ? (
                                                <View key={uri} style={styles.specialPdfThumb}>
                                                    <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                                                    <Text style={styles.specialPdfLabel}>PDF</Text>
                                                </View>
                                            ) : (
                                                <Image key={uri} source={{ uri: getOrderImageUri(uri) }} style={styles.specialImageThumb} />
                                            )
                                        ))}
                                    </View>
                                </View>
                            )}
                            <View style={styles.packageImageWrap}>
                                <View style={styles.packageImageHeader}>
                                    <Text style={styles.packageImageLabel}>Package Photo</Text>
                                    {loadingImageByOrder[item._id] && <Text style={styles.packageImageStatus}>Loading...</Text>}
                                </View>
                                {item.packageImage ? (
                                    <Image
                                        source={{ uri: getPackageImageUri(item) }}
                                        style={styles.packageImage}
                                        onLoadStart={() => setLoadingImageByOrder((current) => ({ ...current, [item._id]: true }))}
                                        onLoadEnd={() => setLoadingImageByOrder((current) => ({ ...current, [item._id]: false }))}
                                        onError={() => setLoadingImageByOrder((current) => ({ ...current, [item._id]: false }))}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={styles.packagePlaceholder}>
                                        <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
                                        <Text style={styles.packagePlaceholderText}>No package photo uploaded</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.assignmentRow}>
                                <Text style={styles.assignmentText}>
                                    Rider: {item.assignedRider?.name || 'Not assigned'}
                                </Text>
                                {(item.status === 'ready' || item.status === 'accepted' || !item.assignedRider) && (
                                    <TouchableOpacity style={styles.assignBtn} onPress={() => assignRider(item)}>
                                        <Ionicons name="person-add-outline" size={14} color="#FFF" />
                                        <Text style={styles.assignBtnText}>Assign</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.empty}><Ionicons name="receipt-outline" size={50} color={colors.textMuted} /><Text style={styles.emptyText}>No orders</Text></View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },
    title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    count: { fontSize: 14, color: colors.textMuted },
    filterList: { paddingHorizontal: 16, paddingVertical: 10 },
    filterChip: {
        minHeight: 42,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.12)',
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.textPrimary, fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    orderCard: { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 16, padding: 14, marginBottom: 10 },
    orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    orderId: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    orderCustomer: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    orderTime: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
    statusBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 36,
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.08)',
    },
    statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
    divider: { height: 1, backgroundColor: colors.glassBorder, marginVertical: 10 },
    itemLine: { fontSize: 12, color: colors.textSecondary, marginBottom: 3 },
    orderBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    specialNote: { fontSize: 11, color: colors.textMuted, flex: 1 },
    orderTotal: { fontSize: 16, fontWeight: '800', color: colors.primary },
    specialImagesWrap: {
        marginTop: 10,
        padding: 10,
        borderRadius: 12,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    specialImagesLabel: { fontSize: 12, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
    specialImagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    specialImageThumb: { width: 58, height: 58, borderRadius: 10, backgroundColor: '#E2E8F0' },
    specialPdfThumb: {
        width: 58,
        height: 58,
        borderRadius: 10,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: 'rgba(37,99,235,0.18)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    specialPdfLabel: { marginTop: 2, fontSize: 8, fontWeight: '800', color: colors.primary },
    packageImageWrap: {
        marginTop: 10,
        padding: 10,
        borderRadius: 12,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    packageImageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    packageImageLabel: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },
    packageImageStatus: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
    packageImage: { width: '100%', height: 160, borderRadius: 10, backgroundColor: '#E2E8F0' },
    packagePlaceholder: { width: '100%', height: 160, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', gap: 6 },
    packagePlaceholderText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: colors.textMuted, marginTop: 8 },
    refundSection: {
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    refundHeading: { color: colors.textPrimary, fontWeight: '800', fontSize: 14, marginBottom: 8 },
    refundRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: colors.glassBorder,
        paddingTop: 10,
        marginTop: 10,
    },
    refundOrder: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
    refundReason: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    refundActionBtn: { backgroundColor: colors.warning, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    refundActionText: { color: '#202020', fontWeight: '800', fontSize: 11 },
    assignmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    assignmentText: { color: colors.textMuted, fontSize: 11 },
    assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    assignBtnText: { color: '#FFF', fontWeight: '700', fontSize: 11 },
});
