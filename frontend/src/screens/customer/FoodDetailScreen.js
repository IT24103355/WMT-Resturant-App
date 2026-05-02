import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { API_BASE_URL } from '../../api/axios';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import colors from '../../styles/colors';

const { width } = Dimensions.get('window');

export default function FoodDetailScreen({ navigation, route }) {
    const { foodId } = route.params;
    const { addToCart } = useCart();
    const { user } = useAuth();
    const [food, setFood] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [ratingSummary, setRatingSummary] = useState({ averageRating: 0, numReviews: 0, dimensionAverages: { foodQuality: 0, deliverySpeed: 0, packaging: 0, service: 0 } });
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }

        if (user?.role === 'admin') {
            navigation.navigate('AdminMain', { screen: 'Foods' });
            return;
        }

        if (user?.role === 'rider') {
            navigation.navigate('RiderMain', { screen: 'Dashboard' });
            return;
        }

        navigation.navigate('CustomerMain', { screen: 'Home' });
    };

    useEffect(() => {
        fetchFood();
        fetchReviews();
    }, []);

    const fetchFood = async () => {
        try {
            const res = await api.get(`/api/foods/${foodId}`);
            setFood(res.data.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchReviews = async () => {
        try {
            const res = await api.get(`/api/reviews/food/${foodId}`);
            setReviews(res.data.data || []);
            setRatingSummary(res.data.ratingSummary || ratingSummary);
        } catch (e) { console.error(e); }
    };

    const handleAddToCart = () => {
        for (let i = 0; i < quantity; i++) {
            addToCart(food);
        }
        const buttons = [
            { text: 'Continue Shopping', style: 'cancel' },
        ];
        if (user?.role === 'customer') {
            buttons.push({ text: 'View Cart', onPress: () => navigation.navigate('CustomerMain', { screen: 'Cart' }) });
        }
        Alert.alert('Added to Cart', `${quantity}x ${food.name} added to your cart!`, buttons);
    };

    if (loading || !food) {
        return (
            <View style={styles.loadingContainer}>
                <Ionicons name="restaurant" size={40} color={colors.primary} />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Hero Image */}
                <View style={styles.heroContainer}>
                    {food.image ? (
                        <Image source={{ uri: `${API_BASE_URL}${food.image}` }} style={styles.heroImage} />
                    ) : (
                        <View style={styles.heroPlaceholder}>
                            <Ionicons name="restaurant" size={80} color={colors.textMuted} />
                        </View>
                    )}
                    <LinearGradient colors={['transparent', colors.background]} style={styles.heroOverlay} />
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Info */}
                <View style={styles.infoSection}>
                    <View style={styles.nameRow}>
                        <Text style={styles.foodName}>{food.name}</Text>
                        {food.isVegetarian && (
                            <View style={styles.vegBadge}>
                                <Text style={styles.vegText}>🌿 Veg</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.category}>{food.category?.name || 'Uncategorized'}</Text>

                    <View style={styles.metaRow}>
                        <View style={styles.metaCard}>
                            <Ionicons name="star" size={18} color={colors.gold} />
                            <Text style={styles.metaValue}>{(ratingSummary.averageRating || food.rating || 0).toFixed(1)}</Text>
                            <Text style={styles.metaLabel}>{ratingSummary.numReviews || food.numReviews} reviews</Text>
                        </View>
                        <View style={styles.metaCard}>
                            <Ionicons name="time-outline" size={18} color={colors.primary} />
                            <Text style={styles.metaValue}>{food.preparationTime}min</Text>
                            <Text style={styles.metaLabel}>Prep Time</Text>
                        </View>
                    </View>

                    <Text style={styles.descTitle}>Description</Text>
                    <Text style={styles.description}>{food.description}</Text>

                    {food.ingredients?.length > 0 && (
                        <>
                            <Text style={styles.descTitle}>Ingredients</Text>
                            <View style={styles.ingredientRow}>
                                {food.ingredients.map((ing, i) => (
                                    <View key={i} style={styles.ingredientChip}>
                                        <Text style={styles.ingredientText}>{ing}</Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    {/* Reviews */}
                    <View style={styles.reviewSection}>
                        <Text style={styles.descTitle}>Reviews ({reviews.length})</Text>
                        <View style={styles.breakdownCard}>
                            <Text style={styles.breakdownTitle}>Rating Breakdown</Text>
                            <Text style={styles.breakdownText}>Food quality: {(ratingSummary.dimensionAverages.foodQuality || 0).toFixed(1)} / 5</Text>
                            <Text style={styles.breakdownText}>Delivery speed: {(ratingSummary.dimensionAverages.deliverySpeed || 0).toFixed(1)} / 5</Text>
                            <Text style={styles.breakdownText}>Packaging: {(ratingSummary.dimensionAverages.packaging || 0).toFixed(1)} / 5</Text>
                            <Text style={styles.breakdownText}>Service: {(ratingSummary.dimensionAverages.service || 0).toFixed(1)} / 5</Text>
                        </View>
                        {reviews.slice(0, 3).map((review) => (
                            <View key={review._id} style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    <View style={styles.reviewAvatar}>
                                        <Text style={styles.avatarText}>{review.user?.name?.[0] || 'U'}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.reviewerName}>{review.user?.name}</Text>
                                        <View style={styles.starsRow}>
                                            {[1, 2, 3, 4, 5].map((s) => (
                                                <Ionicons key={s} name={s <= review.rating ? 'star' : 'star-outline'} size={12} color={colors.gold} />
                                            ))}
                                        </View>
                                    </View>
                                </View>
                                <Text style={styles.reviewComment}>{review.comment}</Text>
                                <View style={styles.reviewMetrics}>
                                    <Text style={styles.reviewMetric}>Food {review.foodQuality}/5</Text>
                                    <Text style={styles.reviewMetric}>Delivery {review.deliverySpeed}/5</Text>
                                    <Text style={styles.reviewMetric}>Pack {review.packaging}/5</Text>
                                    <Text style={styles.reviewMetric}>Service {review.service}/5</Text>
                                </View>
                                {!!review.suggestions && <Text style={styles.reviewSuggestion}>Suggestion: {review.suggestions}</Text>}
                                {review.photos?.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ marginTop: 8 }}>
                                        {review.photos.map((photo) => (
                                            <Image key={photo} source={{ uri: `${API_BASE_URL}${photo}` }} style={styles.reviewPhoto} />
                                        ))}
                                    </ScrollView>
                                )}
                                {review.adminReply && (
                                    <View style={styles.adminReply}>
                                        <Text style={styles.adminReplyLabel}>🏪 Restaurant Reply:</Text>
                                        <Text style={styles.adminReplyText}>{review.adminReply}</Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
                <View style={styles.priceSection}>
                    <Text style={styles.priceLabel}>Total Price</Text>
                    <Text style={styles.price}>Rs. {(food.price * quantity).toFixed(2)}</Text>
                </View>
                <View style={styles.quantitySection}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                        <Ionicons name="remove" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{quantity}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(quantity + 1)}>
                        <Ionicons name="add" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
                    <LinearGradient colors={colors.gradientPrimary} style={styles.addButtonGradient}>
                        <Ionicons name="cart" size={22} color="#FFF" />
                        <Text style={styles.addButtonText}>Add</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    loadingText: { color: colors.textMuted, marginTop: 12 },
    heroContainer: { height: 300, position: 'relative' },
    heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    heroPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundElevated },
    heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 },
    backButton: {
        position: 'absolute', top: 16, left: 16,
        backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: 8,
    },
    infoSection: { paddingHorizontal: 20, paddingBottom: 120 },
    nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -10 },
    foodName: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, flex: 1 },
    vegBadge: { backgroundColor: 'rgba(76,175,80,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    vegText: { color: colors.mild, fontSize: 12, fontWeight: '600' },
    category: { fontSize: 14, color: colors.primary, marginTop: 4, fontWeight: '600' },
    metaRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
    metaCard: {
        flex: 1, alignItems: 'center', backgroundColor: colors.glassBg,
        borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 14, padding: 14,
    },
    metaValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 6 },
    metaLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
    descTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 24, marginBottom: 10 },
    description: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
    ingredientRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    ingredientChip: {
        backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    },
    ingredientText: { color: colors.textSecondary, fontSize: 12 },
    reviewSection: { marginTop: 10 },
    breakdownCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 14, padding: 12, marginBottom: 12 },
    breakdownTitle: { color: colors.textPrimary, fontWeight: '800', marginBottom: 6 },
    breakdownText: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    reviewCard: {
        backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
        borderRadius: 14, padding: 14, marginBottom: 10,
    },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    reviewAvatar: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
        justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    reviewerName: { color: colors.textPrimary, fontWeight: '600', fontSize: 13 },
    starsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
    reviewComment: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
    reviewMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    reviewMetric: { fontSize: 11, color: colors.primary, fontWeight: '700', backgroundColor: 'rgba(255,107,53,0.08)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
    reviewSuggestion: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
    reviewPhoto: { width: 74, height: 74, borderRadius: 10, marginRight: 8 },
    adminReply: {
        marginTop: 10, padding: 10, backgroundColor: 'rgba(255,107,53,0.08)', borderRadius: 10,
        borderLeftWidth: 3, borderLeftColor: colors.primary,
    },
    adminReplyLabel: { color: colors.primary, fontSize: 11, fontWeight: '700', marginBottom: 4 },
    adminReplyText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.backgroundLight, borderTopWidth: 1, borderTopColor: colors.glassBorder,
        padding: 16, paddingBottom: 32,
    },
    priceSection: {},
    priceLabel: { fontSize: 11, color: colors.textMuted },
    price: { fontSize: 22, fontWeight: '900', color: colors.primary },
    quantitySection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    qtyBtn: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
        justifyContent: 'center', alignItems: 'center',
    },
    qtyText: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    addButton: { borderRadius: 14, overflow: 'hidden' },
    addButtonGradient: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 14, paddingHorizontal: 24,
    },
    addButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
