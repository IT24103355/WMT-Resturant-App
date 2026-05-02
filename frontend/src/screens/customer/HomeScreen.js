import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Dimensions, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { API_BASE_URL } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import colors from '../../styles/colors';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
    const { user } = useAuth();
    const { getItemCount } = useCart();
    const [categories, setCategories] = useState([]);
    const [featuredFoods, setFeaturedFoods] = useState([]);
    const [topRatedFoods, setTopRatedFoods] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [reviewInsights, setReviewInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', fetchData);
        return unsubscribe;
    }, [navigation]);

    const fetchData = async () => {
        setErrorMessage('');
        try {
            const [catRes, foodRes, promoRes, insightsRes, topRatedRes] = await Promise.allSettled([
                api.get('/api/categories'),
                api.get('/api/foods'),
                api.get('/api/promotions'),
                api.get('/api/reviews/insights'),
                api.get('/api/foods', { params: { sort: 'popular', limit: 6 } }),
            ]);

            if (catRes.status === 'fulfilled') {
                setCategories(catRes.value.data.data || []);
            } else {
                setCategories([]);
            }

            if (foodRes.status === 'fulfilled') {
                setFeaturedFoods((foodRes.value.data.data || []).slice(0, 6));
            } else {
                setFeaturedFoods([]);
                setErrorMessage('Could not load food items. Please check backend connection.');
            }

            if (promoRes.status === 'fulfilled') {
                setPromotions(promoRes.value.data.data || []);
            } else {
                setPromotions([]);
            }

            if (insightsRes.status === 'fulfilled') {
                setReviewInsights(insightsRes.value.data.data || null);
            }

            if (topRatedRes.status === 'fulfilled') {
                setTopRatedFoods((topRatedRes.value.data.data || []).slice(0, 6));
            }
        } catch (error) {
            console.error('Error fetching home data:', error);
            setErrorMessage('Could not load food items. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const renderPromoCard = (promo, index) => (
        <TouchableOpacity key={promo._id || index} style={styles.promoCard} onPress={() => navigation.navigate('Promotions')}>
            <LinearGradient colors={index % 2 === 0 ? colors.gradientPrimary : colors.gradientGold} style={styles.promoGradient}>
                <View style={styles.promoContent}>
                    <Text style={styles.promoDiscount}>{promo.discountPercentage}% OFF</Text>
                    <Text style={styles.promoTitle}>{promo.title}</Text>
                    <Text style={styles.promoCode}>Use: {promo.code}</Text>
                </View>
                <Ionicons name="pricetag" size={50} color="rgba(255,255,255,0.3)" style={styles.promoIcon} />
            </LinearGradient>
        </TouchableOpacity>
    );

    const renderCategoryCard = (cat) => (
        <TouchableOpacity
            key={cat._id}
            style={styles.categoryCard}
            onPress={() => navigation.navigate('Menu', { categoryId: cat._id, categoryName: cat.name })}
        >
            <View style={styles.categoryIcon}>
                {cat.image ? (
                    <Image source={{ uri: `${API_BASE_URL}${cat.image}` }} style={styles.categoryImage} />
                ) : (
                    <Ionicons name="restaurant" size={24} color={colors.primary} />
                )}
            </View>
            <Text style={styles.categoryName} numberOfLines={1}>{cat.name}</Text>
        </TouchableOpacity>
    );

    const renderFoodCard = (food) => (
        <TouchableOpacity
            key={food._id}
            style={styles.foodCard}
            onPress={() => navigation.navigate('FoodDetail', { foodId: food._id })}
        >
            <View style={styles.foodImageContainer}>
                {food.image ? (
                    <Image source={{ uri: `${API_BASE_URL}${food.image}` }} style={styles.foodImage} />
                ) : (
                    <View style={styles.foodImagePlaceholder}>
                        <Ionicons name="restaurant" size={32} color={colors.textMuted} />
                    </View>
                )}
            </View>
            <View style={styles.foodInfo}>
                <View style={styles.foodHeader}>
                    <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
                    <Text style={styles.foodDesc} numberOfLines={2}>{food.description}</Text>
                </View>
                <View style={styles.foodBottom}>
                    <Text style={styles.foodPrice}>Rs. {food.price}</Text>
                    <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={12} color={colors.gold} />
                        <Text style={styles.ratingText}>{food.rating?.toFixed(1) || '0.0'}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                <View style={styles.bgCircleA} />
                <View style={styles.bgCircleB} />

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Guest'} 👋</Text>
                        <Text style={styles.headerSubtitle}>What would you like to eat?</Text>
                    </View>
                    <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('Cart')}>
                        <Ionicons name="cart-outline" size={26} color={colors.textPrimary} />
                        {getItemCount() > 0 && (
                            <View style={styles.cartBadge}>
                                <Text style={styles.cartBadgeText}>{getItemCount()}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.heroBanner} onPress={() => navigation.navigate('Menu')}>
                    <LinearGradient colors={['#7A1E2C', '#9A2A3A']} style={styles.heroGradient}>
                        <View>
                            <Text style={styles.heroEyebrow}>DINE WAVE</Text>
                            <Text style={styles.heroTitle}>Fresh Sri Lankan Classics</Text>
                            <Text style={styles.heroSubtitle}>Curated flavors, fast delivery, premium kitchen quality.</Text>
                        </View>
                        <View style={styles.heroPill}>
                            <Text style={styles.heroPillText}>Explore Menu</Text>
                            <Ionicons name="arrow-forward" size={14} color="#FFF" />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Promotions Banner */}
                {promotions.length > 0 && (
                    <View style={styles.section}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                            {promotions.map((promo, index) => renderPromoCard(promo, index))}
                        </ScrollView>
                    </View>
                )}

                {/* Categories */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Categories</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Menu')}>
                        <Text style={styles.seeAll}>See All</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                    {categories.map((cat) => renderCategoryCard(cat))}
                </ScrollView>

                {/* Featured Foods */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Featured Dishes</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Menu')}>
                        <Text style={styles.seeAll}>See All</Text>
                    </TouchableOpacity>
                </View>
                {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
                <View style={styles.foodGrid}>
                    {featuredFoods.map((food) => renderFoodCard(food))}
                </View>
                {!loading && featuredFoods.length === 0 && !errorMessage && (
                    <Text style={styles.emptyFoodsText}>No food items available right now.</Text>
                )}

                <View style={styles.reviewSummaryCard}>
                    <View>
                        <Text style={styles.reviewSummaryTitle}>Restaurant Rating</Text>
                        <Text style={styles.reviewSummaryValue}>{(reviewInsights?.averageRating || 0).toFixed(1)} / 5</Text>
                        <Text style={styles.reviewSummarySub}>{reviewInsights?.reviewCount || 0} public reviews</Text>
                    </View>
                    <View style={styles.reviewSummaryPill}>
                        <Text style={styles.reviewSummaryPillText}>Top Rated</Text>
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Top Rated</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Menu')}>
                        <Text style={styles.seeAll}>Browse</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.foodGrid}>
                    {topRatedFoods.map((food) => renderFoodCard(food))}
                </View>

                <View style={{ height: 30 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    bgCircleA: {
        position: 'absolute',
        top: -50,
        right: -40,
        width: 170,
        height: 170,
        borderRadius: 85,
        backgroundColor: 'rgba(122,30,44,0.09)',
    },
    bgCircleB: {
        position: 'absolute',
        top: 240,
        left: -55,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(180,90,60,0.12)',
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
    },
    greeting: { fontSize: 34, fontWeight: '900', color: colors.textPrimary },
    headerSubtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 6, fontWeight: '500' },
    cartButton: {
        position: 'relative',
        padding: 10,
        borderRadius: 14,
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    cartBadge: {
        position: 'absolute', top: 0, right: 0,
        backgroundColor: colors.secondary, width: 20, height: 20, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    cartBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

    heroBanner: {
        marginHorizontal: 16,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 12,
    },
    heroGradient: {
        paddingHorizontal: 20,
        paddingVertical: 20,
        minHeight: 145,
        justifyContent: 'space-between',
    },
    heroEyebrow: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        letterSpacing: 1.5,
        fontWeight: '700',
    },
    heroTitle: {
        color: '#FFFFFF',
        fontSize: 26,
        fontWeight: '900',
        marginTop: 5,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.88)',
        fontSize: 13,
        lineHeight: 18,
        marginTop: 7,
        maxWidth: '88%',
    },
    heroPill: {
        marginTop: 14,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 7,
    },
    heroPillText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 12,
    },

    section: { marginBottom: 8 },
    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, marginTop: 24, marginBottom: 14,
    },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    seeAll: { fontSize: 14, color: colors.primary, fontWeight: '600' },
    errorText: { fontSize: 13, color: colors.danger || '#E74C3C', marginHorizontal: 20, marginTop: -4, marginBottom: 6 },
    emptyFoodsText: { fontSize: 13, color: colors.textMuted, marginHorizontal: 20, marginTop: 2 },

    promoCard: { width: width * 0.75, marginRight: 14, borderRadius: 18, overflow: 'hidden' },
    promoGradient: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 24, borderRadius: 18,
    },
    promoContent: {},
    promoDiscount: { fontSize: 28, fontWeight: '900', color: '#FFF' },
    promoTitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
    promoCode: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 8, fontWeight: '600' },
    promoIcon: { position: 'absolute', right: 20 },

    categoryCard: {
        alignItems: 'center', marginRight: 12,
        backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
        borderRadius: 18, padding: 12, width: 102,
    },
    categoryIcon: {
        width: 54, height: 54, borderRadius: 27,
        backgroundColor: 'rgba(122,30,44,0.12)',
        justifyContent: 'center', alignItems: 'center', marginBottom: 8,
        overflow: 'hidden',
    },
    categoryImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    categoryName: { fontSize: 13, color: colors.textSecondary, fontWeight: '700', textAlign: 'center' },

    foodGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
    foodCard: {
        width: (width - 48) / 2, marginHorizontal: 6, marginBottom: 16,
        backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
        borderRadius: 20, overflow: 'hidden',
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 4,
        minHeight: 285,
        flexDirection: 'column',
    },
    foodImageContainer: { height: 142, backgroundColor: colors.backgroundElevated },
    foodImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    foodImagePlaceholder: {
        width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
        backgroundColor: colors.backgroundElevated,
    },
    foodInfo: { flex: 1, padding: 19, justifyContent: 'space-between' },
    foodHeader: {},
    foodName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
    foodDesc: { fontSize: 12, color: colors.textMuted, marginTop: 5, lineHeight: 16 },
    foodBottom: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 0,
    },
    foodPrice: { fontSize: 18, fontWeight: '900', color: colors.secondary },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ratingText: { fontSize: 14, color: colors.gold, fontWeight: '700' },

    specialBanner: { marginHorizontal: 30, borderRadius: 10, overflow: 'hidden', marginTop: 0 },
    specialGradient: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 10, borderRadius: 10, borderWidth: 10, borderColor: 'rgba(122,30,44,0.24)',
    },
    specialTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    specialSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    reviewSummaryCard: {
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        backgroundColor: colors.glassBg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    reviewSummaryTitle: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
    reviewSummaryValue: { fontSize: 28, fontWeight: '900', color: colors.textPrimary, marginTop: 4 },
    reviewSummarySub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    reviewSummaryPill: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    reviewSummaryPillText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
});
