import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, Linking, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../services/socket';
import colors from '../../styles/colors';

export default function RiderDashboard() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [summary, setSummary] = useState({ completedCount: 0, earnings: 0, performanceScore: '0.0' });
    const [completedDeliveries, setCompletedDeliveries] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [packagePhotos, setPackagePhotos] = useState({});

    useEffect(() => {
        fetchRiderData();
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchRiderData();
        }, [])
    );

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return undefined;

        const handleAssignment = (payload) => {
            if (!payload?.orderId && !payload?.order?._id) return;

            Alert.alert(
                'New Delivery Task',
                `${payload.customerName || 'Customer'} • ${payload.customerAddress || 'Address not available'}`,
                [
                    { text: 'Later', style: 'cancel' },
                    payload.routeUrl
                        ? { text: 'Open Route', onPress: () => Linking.openURL(payload.routeUrl).catch(() => {}) }
                        : undefined,
                ].filter(Boolean)
            );
            fetchRiderData();
        };

        const refreshTasks = () => fetchRiderData();

        socket.on('deliveryAssignment', handleAssignment);
        socket.on('deliveryAssignmentUpdate', refreshTasks);
        socket.on('orderTrackingUpdate', refreshTasks);

        return () => {
            try { socket.off('deliveryAssignment', handleAssignment); } catch (_) {}
            try { socket.off('deliveryAssignmentUpdate', refreshTasks); } catch (_) {}
            try { socket.off('orderTrackingUpdate', refreshTasks); } catch (_) {}
        };
    }, []);

    const fetchRiderData = async () => {
        try {
            const [tasksRes, summaryRes] = await Promise.all([
                api.get('/api/orders/rider/tasks?scope=active'),
                api.get('/api/orders/rider/summary'),
            ]);
            setTasks(tasksRes.data.data || []);
            const summaryData = summaryRes?.data?.data || { completedCount: 0, earnings: 0, performanceScore: '0.0', deliveries: [] };
            setSummary(summaryData);
            setCompletedDeliveries(summaryData.deliveries || []);
        } catch (error) {
            console.error(error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchRiderData();
        setRefreshing(false);
    };

    const activeCount = useMemo(() => tasks.length, [tasks]);

    const updateTaskResponse = async (orderId, action) => {
        try {
            const response = await api.put(`/api/orders/${orderId}/rider-response`, { action });
            await fetchRiderData();
            Alert.alert('Updated', response?.data?.message || (action === 'accept' ? 'Delivery accepted' : 'Delivery rejected'));
        } catch (error) {
            Alert.alert('Failed', error?.response?.data?.message || 'Could not update task response');
        }
    };

    const pickPackagePhoto = async (task) => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera permission is required to capture the package photo.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.85,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
            const asset = result.assets[0];
            setPackagePhotos((current) => ({
                ...current,
                [task._id]: {
                    uri: asset.uri,
                    name: asset.fileName || `package-${task._id}.jpg`,
                    type: asset.mimeType || 'image/jpeg',
                },
            }));
        }
    };

    const updateDeliveryStatus = async (orderId, stage) => {
        try {
            const selectedPhoto = packagePhotos[orderId];
            if (['picked_up', 'out_for_delivery'].includes(stage) && !selectedPhoto?.uri) {
                Alert.alert('Package photo required', 'Capture the package photo before marking the order as picked up.');
                return;
            }

            if (selectedPhoto?.uri) {
                const formData = new FormData();
                formData.append('stage', stage);
                formData.append('packageImage', {
                    uri: selectedPhoto.uri,
                    name: selectedPhoto.name,
                    type: selectedPhoto.type,
                });
                await api.put(`/api/orders/${orderId}/rider-status`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.put(`/api/orders/${orderId}/rider-status`, { stage });
            }

            setPackagePhotos((current) => {
                const next = { ...current };
                delete next[orderId];
                return next;
            });
            await fetchRiderData();
            Alert.alert('Status Updated', `Order marked as ${stage.replace(/_/g, ' ')}`);
        } catch (error) {
            Alert.alert('Failed', error?.response?.data?.message || 'Could not update status');
        }
    };

    const sendCurrentLocation = async (task) => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Location permission is required to share live tracking.');
                return;
            }

            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            await api.put(`/api/orders/${task._id}/rider-location`, {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
            });
            Alert.alert('Location Sent', 'Customer tracking has been updated');
            await fetchRiderData();
        } catch (error) {
            Alert.alert('Failed', error?.response?.data?.message || 'Could not send location');
        }
    };

    const openRoute = async (task) => {
        const destination = task.deliveryLocation?.latitude && task.deliveryLocation?.longitude
            ? `${task.deliveryLocation.latitude},${task.deliveryLocation.longitude}`
            : task.deliveryAddress;

        const routeUrl = task.deliveryLocation?.mapUrl
            || (task.deliveryLocation?.latitude && task.deliveryLocation?.longitude
                ? `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
                : destination
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
                    : '');

        if (!routeUrl) {
            Alert.alert('Route unavailable', 'Customer route is not available yet.');
            return;
        }

        try {
            await Linking.openURL(routeUrl);
        } catch (error) {
            Alert.alert('Route unavailable', 'Could not open navigation route.');
        }
    };

    const renderTaskActions = (task) => {
        const packagePhoto = packagePhotos[task._id];
        if (task.riderAssignmentStatus === 'assigned') {
            return (
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => updateTaskResponse(task._id, 'accept')}>
                        <Text style={styles.actionText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => updateTaskResponse(task._id, 'reject')}>
                        <Text style={styles.actionText}>Reject</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.actionRowWrap}>
                <TouchableOpacity style={styles.photoBtn} onPress={() => pickPackagePhoto(task)}>
                    <Ionicons name="camera-outline" size={14} color="#FFF" />
                    <Text style={styles.photoBtnText}>{packagePhoto?.uri ? 'Change Photo' : 'Package Photo'}</Text>
                </TouchableOpacity>
                {packagePhoto?.uri && (
                    <View style={styles.photoPreviewWrap}>
                        <Image source={{ uri: packagePhoto.uri }} style={styles.photoPreview} />
                        <Text style={styles.photoPreviewText}>Ready to attach</Text>
                    </View>
                )}
                {task.status !== 'picked_up' && (
                    <TouchableOpacity style={styles.statusBtn} onPress={() => updateDeliveryStatus(task._id, 'picked_up')}>
                        <Text style={styles.statusBtnText}>Picked Up</Text>
                    </TouchableOpacity>
                )}
                {task.status !== 'out_for_delivery' && task.status !== 'delivered' && (
                    <TouchableOpacity style={styles.statusBtn} onPress={() => updateDeliveryStatus(task._id, 'out_for_delivery')}>
                        <Text style={styles.statusBtnText}>On The Way</Text>
                    </TouchableOpacity>
                )}
                {task.status !== 'delivered' && (
                    <TouchableOpacity style={[styles.statusBtn, styles.deliveredBtn]} onPress={() => updateDeliveryStatus(task._id, 'delivered')}>
                        <Text style={styles.statusBtnText}>Delivered</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.trackBtn} onPress={() => sendCurrentLocation(task)}>
                    <Ionicons name="navigate" size={14} color={colors.primary} />
                    <Text style={styles.trackText}>Send GPS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.routeBtn} onPress={() => openRoute(task)}>
                    <Ionicons name="map-outline" size={14} color="#FFF" />
                    <Text style={styles.routeBtnText}>Navigate</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Rider Dashboard</Text>
                    <Text style={styles.subtitle}>Welcome {user?.name || 'Rider'} • Manage live deliveries</Text>
                </View>

                <View style={styles.metricGrid}>
                    <View style={styles.metricWrap}>
                        <LinearGradient colors={colors.gradientCard} style={styles.metricCard}>
                            <Text style={styles.metricValue}>{activeCount}</Text>
                            <Text style={styles.metricLabel}>Active Tasks</Text>
                        </LinearGradient>
                    </View>
                    <View style={styles.metricWrap}>
                        <LinearGradient colors={colors.gradientCard} style={styles.metricCard}>
                            <Text style={styles.metricValue}>Rs.{Number(summary.earnings || 0).toFixed(0)}</Text>
                            <Text style={styles.metricLabel}>Earnings</Text>
                        </LinearGradient>
                    </View>
                    <View style={styles.metricWrap}>
                        <LinearGradient colors={colors.gradientCard} style={styles.metricCard}>
                            <Text style={styles.metricValue}>{summary.completedCount || 0}</Text>
                            <Text style={styles.metricLabel}>Completed</Text>
                        </LinearGradient>
                    </View>
                    <View style={styles.metricWrap}>
                        <LinearGradient colors={colors.gradientCard} style={styles.metricCard}>
                            <Text style={styles.metricValue}>{summary.performanceScore || '0.0'}</Text>
                            <Text style={styles.metricLabel}>Performance</Text>
                        </LinearGradient>
                    </View>
                </View>

                <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Assigned Deliveries</Text>
                    {!tasks.length ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="map-outline" size={44} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No assigned deliveries yet</Text>
                        </View>
                    ) : (
                        tasks.map((task) => (
                            <View key={task._id} style={styles.taskCard}>
                                <Text style={styles.taskId}>Order #{task._id.slice(-6).toUpperCase()}</Text>
                                <Text style={styles.taskLine}>Customer: {task.user?.name || 'Customer'} • {task.user?.phone || 'No phone'}</Text>
                                <Text style={styles.taskLine}>Address: {task.deliveryAddress || task.user?.address || 'No address'}</Text>
                                <Text style={styles.taskLine}>ETA: {Number.isFinite(Number(task.riderEtaMinutes)) ? `${task.riderEtaMinutes} min` : 'Not set'}</Text>
                                <Text style={styles.taskLine}>Status: {task.status.replace(/_/g, ' ')}</Text>
                                {task.packageImage && (
                                    <View style={styles.packageImageCard}>
                                        <Text style={styles.packageImageTitle}>Package Photo</Text>
                                        <Image source={{ uri: task.packageImage.startsWith('/') ? `${api.defaults.baseURL || ''}${task.packageImage}` : task.packageImage }} style={styles.packageImage} />
                                    </View>
                                )}
                                {renderTaskActions(task)}
                            </View>
                        ))
                    )}
                </View>

                <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Performance History</Text>
                    {completedDeliveries.length ? completedDeliveries.slice(0, 8).map((delivery) => (
                        <View key={delivery._id} style={styles.historyRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.historyId}>Order #{delivery._id.slice(-6).toUpperCase()}</Text>
                                <Text style={styles.historyMeta}>Delivered {delivery.deliveredAt ? new Date(delivery.deliveredAt).toLocaleDateString() : 'recently'}</Text>
                            </View>
                            <Text style={styles.historyEarnings}>Rs.{Number(delivery.totalAmount || 0).toFixed(0)}</Text>
                        </View>
                    )) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="trophy-outline" size={44} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No completed deliveries yet</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingTop: 10 },
    title: { fontSize: 30, fontWeight: '900', color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 18 },
    metricWrap: { width: '50%', padding: 6 },
    metricCard: { borderRadius: 18, padding: 16, minHeight: 96, justifyContent: 'center' },
    metricValue: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
    metricLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    panel: { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 18, padding: 16, marginHorizontal: 16, marginTop: 16, marginBottom: 24 },
    panelTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
    emptyState: { alignItems: 'center', paddingVertical: 10 },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 10 },
    taskCard: { borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: colors.background },
    taskId: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
    taskLine: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    actionRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
    photoBtnText: { color: '#FFF', fontWeight: '800', fontSize: 11 },
    photoPreviewWrap: { width: '100%', marginTop: 4 },
    photoPreview: { width: '100%', height: 120, borderRadius: 12, backgroundColor: '#E2E8F0' },
    photoPreviewText: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    acceptBtn: { backgroundColor: colors.success, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    rejectBtn: { backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    actionText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
    statusBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
    deliveredBtn: { backgroundColor: colors.delivered },
    statusBtnText: { color: '#FFF', fontWeight: '800', fontSize: 11 },
    trackBtn: {
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.backgroundLight,
    },
    trackText: { color: colors.primary, fontWeight: '700', fontSize: 11 },
    routeBtn: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    routeBtnText: { color: '#FFF', fontWeight: '800', fontSize: 11 },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: colors.glassBorder,
    },
    historyId: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
    historyMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    historyEarnings: { fontSize: 13, fontWeight: '800', color: colors.primary },
    packageImageCard: { marginTop: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.background },
    packageImageTitle: { fontSize: 11, fontWeight: '800', color: colors.textPrimary, padding: 10, paddingBottom: 8 },
    packageImage: { width: '100%', height: 150, backgroundColor: '#E2E8F0' },
});
