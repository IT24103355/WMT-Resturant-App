import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { API_BASE_URL } from '../../api/axios';
import { initializeSocket, getSocket } from '../../services/socket';
import colors from '../../styles/colors';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

const statusConfig = {
    pending: { icon: 'time', color: colors.pending, label: 'Pending' },
    confirmed: { icon: 'checkmark-circle', color: colors.confirmed, label: 'Confirmed' },
    accepted: { icon: 'checkmark-done-circle', color: colors.confirmed, label: 'Accepted' },
    preparing: { icon: 'restaurant', color: colors.preparing, label: 'Preparing' },
    ready: { icon: 'checkmark-done-circle', color: colors.ready, label: 'Ready' },
    picked_up: { icon: 'bicycle', color: colors.info, label: 'Picked Up' },
    out_for_delivery: { icon: 'navigate', color: colors.warning, label: 'On The Way' },
    delivered: { icon: 'bicycle', color: colors.delivered, label: 'Delivered' },
    cancelled: { icon: 'close-circle', color: colors.cancelled, label: 'Cancelled' },
};

const paymentConfig = {
    cash: { label: 'Cash on Delivery', color: colors.success, icon: 'cash-outline' },
    online: { label: 'Online Transfer', color: colors.info, icon: 'phone-portrait-outline' },
    card: { label: 'Card Payment', color: colors.primary, icon: 'card-outline' },
    wallet: { label: 'Digital Wallet', color: colors.warning, icon: 'wallet-outline' },
    paypal: { label: 'PayPal', color: colors.info, icon: 'logo-paypal' },
};

const ORDER_EDIT_WINDOW_MS = 5 * 60 * 1000;

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const currencyText = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const buildDirectionsUrl = (origin, destination) => {
    const hasDestination = Number.isFinite(Number(destination?.latitude)) && Number.isFinite(Number(destination?.longitude));
    if (!hasDestination) return '';

    const params = new URLSearchParams({
        api: '1',
        travelmode: 'driving',
        destination: `${Number(destination.latitude)},${Number(destination.longitude)}`,
    });

    if (Number.isFinite(Number(origin?.latitude)) && Number.isFinite(Number(origin?.longitude))) {
        params.set('origin', `${Number(origin.latitude)},${Number(origin.longitude)}`);
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export default function OrderScreen({ navigation }) {
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [imageLoadingByOrder, setImageLoadingByOrder] = useState({});
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingOrderId, setEditingOrderId] = useState(null);
    const [editAddress, setEditAddress] = useState('');
    const [editInstructions, setEditInstructions] = useState('');
    const [specialRequestImages, setSpecialRequestImages] = useState([]);
    const [submittingEdit, setSubmittingEdit] = useState(false);

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

    useEffect(() => {
        if (user) {
            fetchOrders();
        } else {
            setOrders([]);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const socket = initializeSocket(user);
        if (!socket) return;

        const handleStatusUpdate = (payload) => {
            const id = payload?._id || payload?.orderId;
            if (!payload || !id) return;
            setOrders((prev) => prev.map((o) => (String(o._id) === String(id) ? { ...o, ...payload } : o)));
            if (payload.packageImage) {
                setImageLoadingByOrder((current) => ({ ...current, [id]: false }));
            }
            // notify user if their order changed
            if (payload.status) {
                const label = (statusConfig[payload.status]?.label) || payload.status;
                Alert.alert('Order Update', payload.message || `Order ${id.slice(-6).toUpperCase()} is now ${label}`);
            }
        };

        const handleTrackingUpdate = (payload) => {
            const id = payload?._id || payload?.orderId;
            if (!payload || !id) return;
            setOrders((prev) => prev.map((o) => (String(o._id) === String(id) ? { ...o, ...payload } : o)));
        };

        socket.on('orderStatusUpdate', handleStatusUpdate);
        socket.on('orderTrackingUpdate', handleTrackingUpdate);

        return () => {
            try { socket.off('orderStatusUpdate', handleStatusUpdate); } catch (_) {}
            try { socket.off('orderTrackingUpdate', handleTrackingUpdate); } catch (_) {}
        };
    }, [user]);

    const fetchOrders = async () => {
        try {
            const res = await api.get('/api/orders');
            setOrders(res.data.data || []);
        } catch (e) { console.error(e); }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchOrders();
        setRefreshing(false);
    };

    const getRemainingWindowMs = (createdAt) => {
        const elapsed = Date.now() - new Date(createdAt).getTime();
        return Math.max(0, ORDER_EDIT_WINDOW_MS - elapsed);
    };

    const canModifyOrder = (order) => {
        return order.status === 'pending' && getRemainingWindowMs(order.createdAt) > 0;
    };

    const getRemainingMinutesText = (order) => {
        const minutes = Math.ceil(getRemainingWindowMs(order.createdAt) / 60000);
        return `${minutes} min left to edit/delete`;
    };

    const openEditModal = (order) => {
        setEditingOrderId(order._id);
        setEditAddress(order.deliveryAddress || '');
        setEditInstructions(order.specialInstructions || '');
        setEditModalVisible(true);
    };

    const closeEditModal = () => {
        setEditModalVisible(false);
        setEditingOrderId(null);
        setEditAddress('');
        setEditInstructions('');
    };

    const addSpecialRequestImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission required', 'Please allow photo access to add a special request image.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.85,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
            setSpecialRequestImages((current) => [...current, result.assets[0].uri].slice(0, 5));
        }
    };

    const removeSpecialRequestImage = (uri) => {
        setSpecialRequestImages((current) => current.filter((item) => item !== uri));
    };

    const handleSaveOrderUpdate = async () => {
        if (!editingOrderId) return;

        try {
            setSubmittingEdit(true);
            if (specialRequestImages.length > 0) {
                const formData = new FormData();
                formData.append('deliveryAddress', editAddress);
                formData.append('specialInstructions', editInstructions);

                specialRequestImages.forEach((uri, index) => {
                    const fileName = uri.split('/').pop() || `special-request-${index + 1}.jpg`;
                    const fileType = fileName.split('.').pop() || 'jpg';
                    formData.append('specialRequestImages', {
                        uri,
                        name: fileName,
                        type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
                    });
                });

                await api.put(`/api/orders/${editingOrderId}`, formData);
            } else {
                await api.put(`/api/orders/${editingOrderId}`, {
                    deliveryAddress: editAddress,
                    specialInstructions: editInstructions,
                });
            }

            closeEditModal();
            await fetchOrders();
            Alert.alert('Updated', 'Your order has been updated.');
        } catch (error) {
            Alert.alert('Update Failed', error?.response?.data?.message || 'Could not update this order.');
        } finally {
            setSubmittingEdit(false);
        }
    };

    const handleDeleteOrder = (order) => {
        Alert.alert(
            'Delete Order',
            'Are you sure you want to delete this order?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/api/orders/${order._id}`);
                            await fetchOrders();
                            Alert.alert('Deleted', 'Order deleted successfully.');
                        } catch (error) {
                            Alert.alert('Delete Failed', error?.response?.data?.message || 'Could not delete this order.');
                        }
                    },
                },
            ]
        );
    };

    const { addToCart, updateQuantity } = useCart();

    const handleReorder = async (order) => {
        try {
            for (const itm of order.items) {
                const foodObj = {
                    _id: itm.food?._id || itm.food,
                    name: itm.name || (itm.food && itm.food.name) || 'Food',
                    image: itm.image || (itm.food && itm.food.image) || '',
                    price: itm.price || (itm.food && itm.food.price) || 0,
                };
                addToCart(foodObj);
                updateQuantity(foodObj._id, itm.quantity);
            }
            navigation.navigate('Cart');
        } catch (e) {
            Alert.alert('Reorder Failed', 'Could not add items to cart');
        }
    };

    const openTrackingRoute = async (order) => {
        const url = buildDirectionsUrl(order.riderLiveLocation, order.deliveryLocation) || order.deliveryLocation?.mapUrl;
        if (!url) {
            Alert.alert('Route unavailable', 'Live route is not available yet.');
            return;
        }

        try {
            await Linking.openURL(url);
        } catch (error) {
            Alert.alert('Route unavailable', 'Could not open navigation route.');
        }
    };

    const handleDownloadInvoice = async (order) => {
        try {
            const invoiceNumber = order.invoiceNumber || `INV-${order._id.slice(-6).toUpperCase()}`;
            const invoiceDate = new Date(order.createdAt).toLocaleString();
            const paymentLabel = (paymentConfig[order.paymentMethod] || paymentConfig.cash).label;
            const itemsTotal = (order.items || []).reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);

            const itemRows = (order.items || []).map((item) => `
                <tr>
                    <td>${escapeHtml(item.name || 'Food Item')}</td>
                    <td style="text-align:center;">${Number(item.quantity || 0)}</td>
                    <td style="text-align:right;">${currencyText(item.price)}</td>
                    <td style="text-align:right;">${currencyText(Number(item.price || 0) * Number(item.quantity || 0))}</td>
                </tr>
            `).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <style>
                        @page { margin: 24px; }
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                            color: #0F172A;
                            margin: 0;
                            padding: 0;
                            background: #FFFFFF;
                        }
                        .sheet {
                            border: 1px solid #E2E8F0;
                            border-radius: 18px;
                            padding: 24px;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            margin-bottom: 18px;
                        }
                        .brand {
                            font-size: 26px;
                            font-weight: 800;
                            letter-spacing: 0.4px;
                            color: #F97316;
                            margin: 0;
                        }
                        .subtitle {
                            margin: 4px 0 0;
                            font-size: 12px;
                            color: #64748B;
                        }
                        .invoice-box {
                            text-align: right;
                        }
                        .invoice-title {
                            margin: 0;
                            font-size: 22px;
                            font-weight: 800;
                        }
                        .meta {
                            font-size: 12px;
                            color: #475569;
                            margin-top: 4px;
                            line-height: 1.6;
                        }
                        .info-grid {
                            display: flex;
                            gap: 12px;
                            margin: 18px 0;
                        }
                        .card {
                            flex: 1;
                            background: #F8FAFC;
                            border: 1px solid #E2E8F0;
                            border-radius: 14px;
                            padding: 14px;
                        }
                        .card-title {
                            margin: 0 0 8px;
                            font-size: 12px;
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.8px;
                            color: #F97316;
                        }
                        .card-text {
                            margin: 0;
                            font-size: 12px;
                            line-height: 1.7;
                            color: #0F172A;
                            white-space: pre-line;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 16px;
                        }
                        thead th {
                            font-size: 11px;
                            text-transform: uppercase;
                            letter-spacing: 0.8px;
                            color: #64748B;
                            border-bottom: 1px solid #CBD5E1;
                            padding: 10px 8px;
                        }
                        tbody td {
                            font-size: 12px;
                            padding: 12px 8px;
                            border-bottom: 1px solid #E2E8F0;
                        }
                        .summary {
                            margin-top: 16px;
                            display: flex;
                            justify-content: flex-end;
                        }
                        .summary-box {
                            width: 260px;
                            background: #FFF7ED;
                            border: 1px solid #FDBA74;
                            border-radius: 14px;
                            padding: 14px;
                        }
                        .summary-row {
                            display: flex;
                            justify-content: space-between;
                            font-size: 12px;
                            margin-bottom: 8px;
                            color: #334155;
                        }
                        .summary-total {
                            display: flex;
                            justify-content: space-between;
                            font-size: 15px;
                            font-weight: 800;
                            color: #0F172A;
                            padding-top: 8px;
                            border-top: 1px dashed #FDBA74;
                        }
                        .footer {
                            margin-top: 22px;
                            text-align: center;
                            font-size: 11px;
                            color: #64748B;
                            line-height: 1.6;
                        }
                    </style>
                </head>
                <body>
                    <div class="sheet">
                        <div class="header">
                            <div>
                                <p class="brand">Dine Wave</p>
                                <p class="subtitle">Fresh food delivery invoice</p>
                            </div>
                            <div class="invoice-box">
                                <p class="invoice-title">Invoice</p>
                                <div class="meta">
                                    <div><strong>#${escapeHtml(invoiceNumber)}</strong></div>
                                    <div>${escapeHtml(invoiceDate)}</div>
                                </div>
                            </div>
                        </div>

                        <div class="info-grid">
                            <div class="card">
                                <p class="card-title">Bill To</p>
                                <p class="card-text">${escapeHtml(user?.name || 'Customer')}\n${escapeHtml(user?.email || '')}\n${escapeHtml(order.deliveryAddress || 'Delivery address not provided')}</p>
                            </div>
                            <div class="card">
                                <p class="card-title">Order Details</p>
                                <p class="card-text">Order ID: ${escapeHtml(order._id)}\nStatus: ${escapeHtml(order.status || 'pending')}\nPayment: ${escapeHtml(paymentLabel)}\nPayment Status: ${escapeHtml(order.paymentStatus || 'pending')}</p>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th style="text-align:left;">Item</th>
                                    <th style="text-align:center; width: 80px;">Qty</th>
                                    <th style="text-align:right; width: 110px;">Price</th>
                                    <th style="text-align:right; width: 120px;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemRows || '<tr><td colspan="4">No items found</td></tr>'}
                            </tbody>
                        </table>

                        <div class="summary">
                            <div class="summary-box">
                                <div class="summary-row"><span>Items total</span><span>${currencyText(itemsTotal)}</span></div>
                                <div class="summary-row"><span>Delivery</span><span>Included</span></div>
                                <div class="summary-total"><span>Grand Total</span><span>${currencyText(order.totalAmount)}</span></div>
                            </div>
                        </div>

                        <div class="footer">
                            Thank you for choosing Dine Wave.<br />
                            For support, please contact our customer care team.
                        </div>
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Invoice ${invoiceNumber}`,
                    UTI: 'com.adobe.pdf',
                });
            } else {
                Alert.alert('Invoice PDF', `Saved to ${uri}`);
            }
        } catch (e) {
            Alert.alert('Invoice', 'Could not share invoice');
        }
    };

    const handleDownloadReceipt = async (order) => {
        try {
            const receiptText = order.receiptText || [
                'Dine Wave Receipt',
                `Receipt No: ${order.invoiceNumber || `INV-${order._id.slice(-6).toUpperCase()}`}`,
                `Order: ${order._id}`,
                `Date: ${new Date(order.createdAt).toLocaleString()}`,
                `Payment Method: ${(paymentConfig[order.paymentMethod] || paymentConfig.cash).label}`,
                `Payment Status: ${order.paymentStatus || 'pending'}`,
                `Total: Rs. ${Number(order.totalAmount || 0).toFixed(2)}`,
            ].join('\n');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <style>
                        @page { margin: 24px; }
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                            color: #0F172A;
                            margin: 0;
                            padding: 0;
                            background: #FFFFFF;
                        }
                        .sheet {
                            border: 1px solid #E2E8F0;
                            border-radius: 18px;
                            padding: 24px;
                        }
                        .title {
                            margin: 0 0 6px;
                            font-size: 24px;
                            font-weight: 800;
                            color: #F97316;
                        }
                        .subtitle {
                            margin: 0 0 18px;
                            color: #64748B;
                            font-size: 12px;
                        }
                        pre {
                            white-space: pre-wrap;
                            font-family: inherit;
                            font-size: 13px;
                            line-height: 1.8;
                            background: #F8FAFC;
                            border: 1px solid #E2E8F0;
                            border-radius: 14px;
                            padding: 16px;
                        }
                    </style>
                </head>
                <body>
                    <div class="sheet">
                        <p class="title">Receipt</p>
                        <p class="subtitle">Keep this as your payment proof</p>
                        <pre>${escapeHtml(receiptText)}</pre>
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Receipt ${order.invoiceNumber || order._id.slice(-6).toUpperCase()}`,
                    UTI: 'com.adobe.pdf',
                });
            } else {
                Alert.alert('Receipt PDF', `Saved to ${uri}`);
            }
        } catch (e) {
            Alert.alert('Receipt', 'Could not share receipt');
        }
    };

    const handleRefundRequest = (order) => {
        Alert.alert('Request Refund', 'Submit refund request for this order?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Submit',
                onPress: async () => {
                    try {
                        await api.post(`/api/payments/refund-request/${order._id}`, { reason: 'Customer requested refund' });
                        Alert.alert('Submitted', 'Refund request has been submitted');
                        fetchOrders();
                    } catch (e) {
                        Alert.alert('Refund Failed', e?.response?.data?.message || 'Could not request refund');
                    }
                },
            },
        ]);
    };

    const renderOrder = ({ item }) => {
        const status = statusConfig[item.status] || statusConfig.pending;
        const editable = canModifyOrder(item);
        return (
            <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                    <View>
                        <Text style={styles.orderId}>Order #{item._id.slice(-6).toUpperCase()}</Text>
                        <Text style={styles.orderDate}>{new Date(item.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${status.color}20` }]}>
                        <Ionicons name={status.icon} size={14} color={status.color} />
                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                </View>
                <View style={styles.divider} />
                {item.items.map((orderItem, index) => (
                    <View key={index} style={styles.orderItem}>
                        <Text style={styles.itemQty}>{orderItem.quantity}x</Text>
                        <Text style={styles.itemName}>{orderItem.name || 'Food Item'}</Text>
                        <Text style={styles.itemPrice}>Rs. {(orderItem.price * orderItem.quantity).toFixed(2)}</Text>
                    </View>
                ))}
                <View style={styles.divider} />
                <View style={styles.orderFooter}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>Rs. {item.totalAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.packageImageCard}>
                    <View style={styles.packageImageHeader}>
                        <Text style={styles.packageImageTitle}>Package Photo</Text>
                        {imageLoadingByOrder[item._id] && <Text style={styles.packageImageStatus}>Loading...</Text>}
                    </View>
                    {item.packageImage ? (
                        <Image
                            source={{ uri: getPackageImageUri(item) }}
                            style={styles.packageImage}
                            onLoadStart={() => setImageLoadingByOrder((current) => ({ ...current, [item._id]: true }))}
                            onLoadEnd={() => setImageLoadingByOrder((current) => ({ ...current, [item._id]: false }))}
                            onError={() => setImageLoadingByOrder((current) => ({ ...current, [item._id]: false }))}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.packagePlaceholder}>
                            <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
                            <Text style={styles.packagePlaceholderText}>Package photo not uploaded yet</Text>
                        </View>
                    )}
                </View>
                <View style={styles.paymentRow}>
                    <View style={[styles.paymentBadge, { backgroundColor: `${(paymentConfig[item.paymentMethod] || paymentConfig.cash).color}18` }]}>
                        <Ionicons name={(paymentConfig[item.paymentMethod] || paymentConfig.cash).icon} size={12} color={(paymentConfig[item.paymentMethod] || paymentConfig.cash).color} />
                        <Text style={[styles.paymentText, { color: (paymentConfig[item.paymentMethod] || paymentConfig.cash).color }]}>
                            {(paymentConfig[item.paymentMethod] || paymentConfig.cash).label}
                        </Text>
                    </View>
                    <View style={[styles.paymentBadge, { backgroundColor: `${colors.textMuted}18` }]}>
                        <Text style={[styles.paymentText, { color: colors.textMuted }]}>Payment: {item.paymentStatus || 'pending'}</Text>
                    </View>
                    {!!item.invoiceNumber && (
                        <View style={[styles.paymentBadge, { backgroundColor: `${colors.primary}14` }]}>
                            <Text style={[styles.paymentText, { color: colors.primary }]}>Invoice: {item.invoiceNumber}</Text>
                        </View>
                    )}
                    {item.paymentMethod === 'online' && (
                        <View style={[styles.paymentBadge, { backgroundColor: `${colors.info}14` }]}> 
                            <Text style={[styles.paymentText, { color: colors.info }]}>{item.receiptFile ? 'Receipt uploaded' : 'Awaiting receipt'}</Text>
                        </View>
                    )}
                </View>
                {!!item.assignedRider && (
                    <View style={styles.assignmentCard}>
                        <Text style={styles.assignmentTitle}>Assigned Rider</Text>
                        <Text style={styles.assignmentText}>{item.assignedRider.name || 'Rider'} • {item.assignedRider.phone || 'No phone'}</Text>
                        <Text style={styles.assignmentText}>{item.deliveryAddress || 'Delivery address not set'}</Text>
                    </View>
                )}
                {!!item.specialInstructions && (
                    <Text style={styles.instructionsText}>Note: {item.specialInstructions}</Text>
                )}
                {item.specialRequestImages?.length > 0 && (
                    <View style={styles.requestImagesCard}>
                                    <Text style={styles.requestImagesTitle}>Special Request Files ({item.specialRequestImages.length})</Text>
                        <View style={styles.requestImagesRow}>
                            {item.specialRequestImages.slice(0, 4).map((uri) => (
                                            isPdfAttachment(uri) ? (
                                                <View key={uri} style={styles.specialPdfThumb}>
                                                    <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                                                    <Text style={styles.specialPdfLabel} numberOfLines={2}>PDF</Text>
                                                </View>
                                            ) : (
                                                <Image key={uri} source={{ uri: getOrderImageUri(uri) }} style={styles.requestImageThumb} />
                                            )
                            ))}
                        </View>
                    </View>
                )}
                {(['accepted', 'ready', 'picked_up', 'out_for_delivery'].includes(item.status) || item.assignedRider) && (
                    <View style={styles.trackingCard}>
                        <Text style={styles.trackingTitle}>Live Delivery Tracking</Text>
                        <Text style={styles.trackingText}>ETA: {Number.isFinite(Number(item.riderEtaMinutes)) ? `${item.riderEtaMinutes} min` : 'Calculating...'}</Text>
                        <Text style={styles.trackingText}>
                            Rider Location: {
                                Number.isFinite(Number(item.riderLiveLocation?.latitude)) && Number.isFinite(Number(item.riderLiveLocation?.longitude))
                                    ? `${Number(item.riderLiveLocation.latitude).toFixed(5)}, ${Number(item.riderLiveLocation.longitude).toFixed(5)}`
                                    : 'Waiting for GPS update'
                            }
                        </Text>
                        <TouchableOpacity style={styles.routeButton} onPress={() => openTrackingRoute(item)}>
                            <Ionicons name="navigate" size={14} color="#FFFFFF" />
                            <Text style={styles.routeButtonText}>Open Route</Text>
                        </TouchableOpacity>
                    </View>
                )}
                <View style={styles.bottomActionRow}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => handleReorder(item)}>
                        <Ionicons name="repeat" size={14} color={colors.primary} />
                        <Text style={styles.secondaryButtonText}>Reorder</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => handleDownloadReceipt(item)}>
                        <Ionicons name="receipt-outline" size={14} color={colors.primary} />
                        <Text style={styles.secondaryButtonText}>Receipt</Text>
                    </TouchableOpacity>
                    {item.status === 'delivered' && (
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Review', { orderId: item._id })}>
                            <Ionicons name="star-outline" size={14} color={colors.secondary} />
                            <Text style={[styles.secondaryButtonText, { color: colors.secondary }]}>Review</Text>
                        </TouchableOpacity>
                    )}
                    {item.status === 'cancelled' && item.paymentStatus === 'paid' && item.refund?.status !== 'pending' && (
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => handleRefundRequest(item)}>
                            <Ionicons name="refresh-outline" size={14} color={colors.warning} />
                            <Text style={[styles.secondaryButtonText, { color: colors.warning }]}>Refund</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {item.refund?.status && item.refund.status !== 'none' && (
                    <Text style={styles.refundText}>Refund: {item.refund.status}{item.refund.reason ? ` • ${item.refund.reason}` : ''}</Text>
                )}
                {editable ? (
                    <>
                        <Text style={styles.windowHint}>{getRemainingMinutesText(item)}</Text>
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item)}>
                                <Ionicons name="create-outline" size={14} color="#FFFFFF" />
                                <Text style={styles.actionButtonText}>Update</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteOrder(item)}>
                                <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                                <Text style={styles.actionButtonText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <Text style={styles.windowExpiredText}>Order update/delete is available for 5 minutes after placing the order.</Text>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {!user ? (
                <View style={styles.guestState}>
                    <Ionicons name="lock-closed-outline" size={66} color={colors.textMuted} />
                    <Text style={styles.guestTitle}>Login Required</Text>
                    <Text style={styles.guestSubtext}>Sign in to view your order history</Text>
                    <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate('Login')}>
                        <Text style={styles.loginButtonText}>Login / Sign Up</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
            <View style={styles.header}>
                <Text style={styles.title}>My Orders</Text>
                <Text style={styles.subtitle}>{orders.length} orders</Text>
            </View>
            <FlatList
                data={orders}
                keyExtractor={(item) => item._id}
                renderItem={renderOrder}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="receipt-outline" size={70} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No orders yet</Text>
                        <Text style={styles.emptySubtext}>Your order history will appear here</Text>
                    </View>
                }
            />
            <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={closeEditModal}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Update Order</Text>
                        <Text style={styles.modalLabel}>Delivery Address</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editAddress}
                            onChangeText={setEditAddress}
                            placeholder="Enter delivery address"
                            placeholderTextColor={colors.textMuted}
                        />
                        <Text style={styles.modalLabel}>Special Instructions</Text>
                        <TextInput
                            style={[styles.modalInput, styles.modalInputMultiline]}
                            value={editInstructions}
                            onChangeText={setEditInstructions}
                            placeholder="Any notes for your order"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={3}
                        />
                        <View style={styles.specialImagesSection}>
                            <View style={styles.specialImagesHeader}>
                                <Text style={styles.modalLabel}>Special Request Images</Text>
                                <TouchableOpacity onPress={addSpecialRequestImage} style={styles.addImageBtn}>
                                    <Ionicons name="add" size={14} color="#FFF" />
                                    <Text style={styles.addImageBtnText}>Add Image</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.specialImagesHint}>Upload up to 5 photos to describe your special request.</Text>
                            <View style={styles.specialImagesGrid}>
                                {specialRequestImages.length > 0 ? (
                                    specialRequestImages.map((uri) => (
                                        <TouchableOpacity key={uri} style={styles.specialImageThumbWrap} onPress={() => removeSpecialRequestImage(uri)}>
                                            <Image source={{ uri: getOrderImageUri(uri) }} style={styles.specialImageThumb} />
                                            <View style={styles.specialImageRemoveBadge}>
                                                <Ionicons name="close" size={12} color="#FFF" />
                                            </View>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <View style={styles.specialImagesEmpty}>
                                        <Ionicons name="image-outline" size={18} color={colors.textMuted} />
                                        <Text style={styles.specialImagesEmptyText}>No images selected</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <View style={styles.modalActionRow}>
                            <TouchableOpacity style={styles.modalCancelButton} onPress={closeEditModal} disabled={submittingEdit}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveOrderUpdate} disabled={submittingEdit}>
                                <Text style={styles.modalSaveText}>{submittingEdit ? 'Saving...' : 'Save'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
    title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    orderCard: {
        backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
        borderRadius: 18, padding: 16, marginBottom: 14,
    },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    orderId: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    orderDate: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    },
    statusText: { fontSize: 12, fontWeight: '700' },
    divider: { height: 1, backgroundColor: colors.glassBorder, marginVertical: 12 },
    orderItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    itemQty: { fontSize: 13, color: colors.primary, fontWeight: '700', width: 30 },
    itemName: { flex: 1, fontSize: 13, color: colors.textSecondary },
    itemPrice: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
    orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
    totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
    paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    paymentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    instructionsText: {
        marginTop: 10,
        fontSize: 12,
        color: colors.textSecondary,
    },
    requestImagesCard: {
        marginTop: 10,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 12,
        padding: 10,
    },
    requestImagesTitle: { fontSize: 12, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
    requestImagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    requestImageThumb: { width: 68, height: 68, borderRadius: 10, backgroundColor: '#E2E8F0' },
    specialPdfThumb: {
        width: 68,
        height: 68,
        borderRadius: 10,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: 'rgba(37,99,235,0.18)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    specialPdfLabel: { marginTop: 2, fontSize: 8, fontWeight: '800', color: colors.primary, textAlign: 'center' },
    windowHint: {
        marginTop: 10,
        fontSize: 12,
        color: colors.warning,
        fontWeight: '700',
    },
    windowExpiredText: {
        marginTop: 10,
        fontSize: 12,
        color: colors.textMuted,
    },
    bottomActionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    secondaryButton: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
        borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.background,
    },
    secondaryButtonText: { color: colors.primary, fontWeight: '700' },
    refundText: { marginTop: 8, fontSize: 11, color: colors.warning, fontWeight: '700' },
    trackingCard: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 10,
        backgroundColor: colors.background,
        padding: 10,
    },
    trackingTitle: { fontSize: 12, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    trackingText: { fontSize: 11, color: colors.textSecondary },
    routeButton: {
        marginTop: 8,
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    routeButtonText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
    },
    editButton: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    deleteButton: {
        backgroundColor: colors.danger,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 12,
    },
    paymentText: { fontSize: 11, fontWeight: '700' },
    packageImageCard: {
        marginTop: 10,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        backgroundColor: colors.background,
    },
    packageImageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, paddingBottom: 8 },
    packageImageTitle: { fontSize: 11, fontWeight: '800', color: colors.textPrimary, padding: 10, paddingBottom: 8 },
    packageImageStatus: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
    packageImage: { width: '100%', height: 150, backgroundColor: '#E2E8F0' },
    packagePlaceholder: { height: 150, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', gap: 6 },
    packagePlaceholderText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
    assignmentCard: {
        marginTop: 10,
        padding: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(122,30,44,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(122,30,44,0.12)',
    },
    assignmentTitle: { fontSize: 11, fontWeight: '800', color: colors.primary, marginBottom: 4 },
    assignmentText: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyText: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 16 },
    emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    guestState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    guestTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.textPrimary,
        marginTop: 14,
    },
    guestSubtext: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 6,
    },
    loginButton: {
        marginTop: 20,
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingHorizontal: 22,
        paddingVertical: 12,
    },
    loginButtonText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        backgroundColor: colors.backgroundLight,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: 10,
    },
    modalLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 6,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.textPrimary,
        marginBottom: 10,
        backgroundColor: colors.background,
    },
    modalInputMultiline: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    specialImagesSection: { marginTop: 12 },
    specialImagesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
    addImageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
    addImageBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
    specialImagesHint: { marginTop: 6, fontSize: 11, color: colors.textMuted },
    specialImagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
    specialImageThumbWrap: { position: 'relative' },
    specialImageThumb: { width: 84, height: 84, borderRadius: 12, backgroundColor: '#E2E8F0' },
    specialImageRemoveBadge: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
    specialImagesEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
    specialImagesEmptyText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    modalActionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 8,
    },
    modalCancelButton: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        backgroundColor: colors.background,
    },
    modalCancelText: {
        color: colors.textSecondary,
        fontWeight: '700',
    },
    modalSaveButton: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: colors.primary,
    },
    modalSaveText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
});
