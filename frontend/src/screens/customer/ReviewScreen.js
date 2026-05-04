import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Image, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import api, { API_BASE_URL } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import colors from '../../styles/colors';

const RatingRow = ({ label, value, onChange }) => (
    <View style={styles.ratingRow}>
        <Text style={styles.ratingLabel}>{label}</Text>
        <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => onChange(star)} style={styles.starBtn}>
                    <Ionicons name={star <= value ? 'star' : 'star-outline'} size={22} color={colors.gold} />
                </TouchableOpacity>
            ))}
        </View>
    </View>
);

export default function ReviewScreen({ navigation, route }) {
    const { user } = useAuth();
    const preselectedOrderId = route?.params?.orderId || null;
    const [orders, setOrders] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState(preselectedOrderId);
    const [selectedFoodId, setSelectedFoodId] = useState('');
    const [foodQuality, setFoodQuality] = useState(5);
    const [deliverySpeed, setDeliverySpeed] = useState(5);
    const [packaging, setPackaging] = useState(5);
    const [service, setService] = useState(5);
    const [overallRating, setOverallRating] = useState(5);
    const [comment, setComment] = useState('');
    const [suggestions, setSuggestions] = useState('');
    const [photos, setPhotos] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    useEffect(() => {
        if (preselectedOrderId) {
            setSelectedOrderId(preselectedOrderId);
        }
    }, [preselectedOrderId]);

    const fetchData = async () => {
        try {
            const [ordersRes, reviewsRes] = await Promise.all([
                api.get('/api/orders'),
                api.get('/api/reviews/mine'),
            ]);
            setOrders((ordersRes.data.data || []).filter((order) => order.status === 'delivered'));
            setReviews(reviewsRes.data.data || []);
        } catch (error) {
            console.error(error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const selectedOrder = useMemo(() => orders.find((order) => order._id === selectedOrderId) || null, [orders, selectedOrderId]);

    useEffect(() => {
        if (selectedOrder && selectedOrder.items?.length) {
            setSelectedFoodId(String(selectedOrder.items[0].food?._id || selectedOrder.items[0].food));
        }
    }, [selectedOrderId, orders]);

    const addPhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
        });

        if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            setPhotos((prev) => [...prev, asset].slice(0, 5));
        }
    };

    const removePhoto = (uri) => {
        setPhotos((prev) => prev.filter((photo) => photo.uri !== uri));
    };

    const submitReview = async () => {
        if (!selectedOrder || !selectedFoodId) {
            Alert.alert('Select order', 'Please choose a completed order and a food item to review.');
            return;
        }

        if (!comment.trim()) {
            Alert.alert('Comment required', 'Please add a comment for your review.');
            return;
        }

        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('order', selectedOrder._id);
            formData.append('food', selectedFoodId);
            formData.append('foodQuality', String(foodQuality));
            formData.append('deliverySpeed', String(deliverySpeed));
            formData.append('packaging', String(packaging));
            formData.append('service', String(service));
            formData.append('overallRating', String(overallRating));
            formData.append('comment', comment);
            formData.append('suggestions', suggestions);

            photos.forEach((photo, index) => {
                const uriParts = photo.uri.split('/');
                const fileName = uriParts[uriParts.length - 1] || `review-${index}.jpg`;
                const ext = fileName.split('.').pop() || 'jpg';
                formData.append('photos', {
                    uri: photo.uri,
                    name: fileName,
                    type: `image/${ext}`,
                });
            });

            await api.post('/api/reviews', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            Alert.alert('Thank you', 'Your review was submitted successfully.');
            setComment('');
            setSuggestions('');
            setPhotos([]);
            setFoodQuality(5);
            setDeliverySpeed(5);
            setPackaging(5);
            setService(5);
            setOverallRating(5);
            await fetchData();
        } catch (error) {
            Alert.alert('Submit failed', error?.response?.data?.message || 'Could not submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const reviewedKeySet = useMemo(() => {
        return new Set(reviews.map((review) => `${review.order?._id || review.order}-${review.food?._id || review.food}`));
    }, [reviews]);

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.emptyState}>
                    <Ionicons name="lock-closed-outline" size={56} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>Login required</Text>
                    <Text style={styles.emptyText}>Sign in to submit and view reviews.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Reviews & Ratings</Text>
                    <Text style={styles.subtitle}>Rate food quality, delivery, packaging, and service</Text>
                </View>

                <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Completed Orders</Text>
                    {orders.length === 0 ? (
                        <Text style={styles.helper}>No delivered orders are ready for review yet.</Text>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
                            {orders.map((order) => (
                                <TouchableOpacity
                                    key={order._id}
                                    style={[styles.orderChip, selectedOrderId === order._id && styles.orderChipActive]}
                                    onPress={() => {
                                        setSelectedOrderId(order._id);
                                        setSelectedFoodId(String(order.items?.[0]?.food?._id || order.items?.[0]?.food || ''));
                                    }}
                                >
                                    <Text style={[styles.orderChipText, selectedOrderId === order._id && styles.orderChipTextActive]}>
                                        #{order._id.slice(-6).toUpperCase()}
                                    </Text>
                                    <Text style={[styles.orderChipSub, selectedOrderId === order._id && styles.orderChipTextActive]}>
                                        {new Date(order.createdAt).toLocaleDateString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>

                {selectedOrder && (
                    <View style={styles.panel}>
                        <Text style={styles.panelTitle}>Select Food Item</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
                            {selectedOrder.items.map((item) => {
                                const foodId = String(item.food?._id || item.food);
                                const alreadyReviewed = reviewedKeySet.has(`${selectedOrder._id}-${foodId}`);
                                return (
                                    <TouchableOpacity
                                        key={foodId}
                                        style={[
                                            styles.foodChip,
                                            selectedFoodId === foodId && styles.foodChipActive,
                                            alreadyReviewed && styles.foodChipDisabled,
                                        ]}
                                        disabled={alreadyReviewed}
                                        onPress={() => setSelectedFoodId(foodId)}
                                    >
                                        <Text style={[styles.foodChipText, selectedFoodId === foodId && styles.foodChipTextActive]}>
                                            {item.name || 'Food'}
                                        </Text>
                                        {alreadyReviewed && <Text style={styles.foodChipSub}>Reviewed</Text>}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Your Rating</Text>
                    <RatingRow label="Food Quality" value={foodQuality} onChange={setFoodQuality} />
                    <RatingRow label="Delivery Speed" value={deliverySpeed} onChange={setDeliverySpeed} />
                    <RatingRow label="Packaging" value={packaging} onChange={setPackaging} />
                    <RatingRow label="Service" value={service} onChange={setService} />
                    <RatingRow label="Overall" value={overallRating} onChange={setOverallRating} />
                </View>

                <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Write Your Feedback</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Tell us what you liked or what went wrong"
                        placeholderTextColor={colors.textMuted}
                        value={comment}
                        onChangeText={setComment}
                        multiline
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Suggestions for improvement"
                        placeholderTextColor={colors.textMuted}
                        value={suggestions}
                        onChangeText={setSuggestions}
                        multiline
                    />
                    <View style={styles.photoHeader}>
                        <Text style={styles.photoLabel}>Photos</Text>
                        <TouchableOpacity style={styles.photoAddBtn} onPress={addPhoto}>
                            <Ionicons name="camera-outline" size={16} color={colors.primary} />
                            <Text style={styles.photoAddText}>Add Photo</Text>
                        </TouchableOpacity>
                    </View>
                    {photos.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
                            {photos.map((photo) => (
                                <View key={photo.uri} style={styles.photoWrap}>
                                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                                    <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(photo.uri)}>
                                        <Ionicons name="close" size={14} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                    <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={submitReview} disabled={submitting}>
                        <LinearGradient colors={colors.gradientPrimary} style={styles.submitGradient}>
                            <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Review'}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Your Reviews</Text>
                    {reviews.length === 0 ? (
                        <Text style={styles.helper}>Your past reviews will appear here.</Text>
                    ) : (
                        reviews.map((review) => (
                            <View key={review._id} style={styles.reviewCard}>
                                <View style={styles.reviewTop}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{review.food?.name?.[0] || 'F'}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.reviewFood}>{review.food?.name || 'Food Item'}</Text>
                                        <Text style={styles.reviewMeta}>Order #{review.order?._id?.slice(-6)?.toUpperCase() || 'N/A'}</Text>
                                    </View>
                                    <View style={styles.ratingBadge}>
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Ionicons key={s} name={s <= (review.overallRating || review.rating) ? 'star' : 'star-outline'} size={12} color={colors.gold} />
                                        ))}
                                    </View>
                                </View>
                                <Text style={styles.reviewComment}>{review.comment}</Text>
                                {!!review.suggestions && <Text style={styles.reviewSuggestion}>Suggestion: {review.suggestions}</Text>}
                                {!!review.adminReply && (
                                    <View style={styles.replyBox}>
                                        <Text style={styles.replyLabel}>Restaurant Reply</Text>
                                        <Text style={styles.replyText}>{review.adminReply}</Text>
                                    </View>
                                )}
                                {review.photos?.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8 }}>
                                        {review.photos.map((photo) => (
                                            <Image key={photo} source={{ uri: `${API_BASE_URL}${photo}` }} style={styles.reviewPhoto} />
                                        ))}
                                    </ScrollView>
                                )}
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingTop: 10 },
    title: { fontSize: 28, fontWeight: '900', color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    panel: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 16,
        borderRadius: 18,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    panelTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 10 },
    helper: { color: colors.textMuted, fontSize: 12 },
    orderChip: {
        width: 120,
        marginRight: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        backgroundColor: colors.background,
        padding: 12,
    },
    orderChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    orderChipText: { color: colors.textPrimary, fontWeight: '800', fontSize: 12 },
    orderChipTextActive: { color: '#FFF' },
    orderChipSub: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
    foodChip: {
        marginRight: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        backgroundColor: colors.background,
        padding: 12,
        minWidth: 120,
    },
    foodChipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
    foodChipDisabled: { opacity: 0.45 },
    foodChipText: { color: colors.textPrimary, fontWeight: '700', fontSize: 12 },
    foodChipTextActive: { color: '#FFF' },
    foodChipSub: { color: '#FFF', fontSize: 10, marginTop: 4 },
    ratingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    ratingLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    starsRow: { flexDirection: 'row' },
    starBtn: { paddingHorizontal: 2 },
    input: {
        minHeight: 88,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: colors.textPrimary,
        backgroundColor: colors.background,
        marginBottom: 12,
        textAlignVertical: 'top',
    },
    photoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    photoLabel: { color: colors.textSecondary, fontWeight: '700' },
    photoAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    photoAddText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
    photoWrap: { marginRight: 10, position: 'relative' },
    photo: { width: 86, height: 86, borderRadius: 12 },
    removePhotoBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.danger,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 6 },
    submitGradient: { paddingVertical: 14, alignItems: 'center' },
    submitText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
    reviewCard: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
    },
    reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#FFF', fontWeight: '800' },
    reviewFood: { color: colors.textPrimary, fontWeight: '800' },
    reviewMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    ratingBadge: { flexDirection: 'row' },
    reviewComment: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
    reviewSuggestion: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
    replyBox: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,107,53,0.08)' },
    replyLabel: { color: colors.primary, fontWeight: '800', fontSize: 11, marginBottom: 4 },
    replyText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
    reviewPhoto: { width: 78, height: 78, borderRadius: 10, marginRight: 8 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 120 },
    emptyTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 14 },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
});
