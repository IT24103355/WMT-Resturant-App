import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, TextInput, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { API_BASE_URL } from '../../api/axios';
import colors from '../../styles/colors';

const { width } = Dimensions.get('window');

export default function MenuScreen({ navigation, route }) {
    const [foods, setFoods] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(route?.params?.categoryId || null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState('newest');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [promotions, setPromotions] = useState([]);

    useEffect(() => {
        if (route?.params?.categoryId) {
            setSelectedCategory(route.params.categoryId);
        }
    }, [route?.params?.categoryId]);

    useEffect(() => {
        fetchFoods();
        fetchPromotions();
    }, []);

    useEffect(() => {
        fetchFoods();
    }, [selectedCategory, searchQuery]);

    useEffect(() => {
        fetchFoods();
    }, [sortOption, minPrice, maxPrice]);

    const fetchFoods = async () => {
        setErrorMessage('');
        try {
            const params = {};
            if (selectedCategory) params.category = selectedCategory;
            if (searchQuery) params.search = searchQuery;
            if (minPrice) params.minPrice = minPrice;
            if (maxPrice) params.maxPrice = maxPrice;
            if (sortOption === 'price-asc') params.sort = 'priceAsc';
            if (sortOption === 'price-desc') params.sort = 'priceDesc';
            if (sortOption === 'popular') params.sort = 'popular';

            const res = await api.get('/api/foods', { params });
            setFoods(res.data.data || []);
        } catch (e) {
            console.error(e);
            setFoods([]);
            setErrorMessage('Could not load food items. Please check backend connection.');
        }
        finally { setLoading(false); }
    };

    const fetchPromotions = async () => {
        try {
            const res = await api.get('/api/promotions');
            setPromotions(res.data.data || []);
        } catch (e) { console.warn('promos', e); }
    };

    const renderFoodItem = ({ item }) => {
        const hasDiscount = promotions.some((p) =>
            (p.applicableFoods || []).some((f) => String(f?._id || f) === String(item._id))
        );

        return (
            <TouchableOpacity style={styles.foodCard} onPress={() => navigation.navigate('FoodDetail', { foodId: item._id })}>
                <View style={styles.foodImageWrap}>
                    {item.image ? (
                        <Image source={{ uri: `${API_BASE_URL}${item.image}` }} style={styles.foodImage} />
                    ) : (
                        <View style={styles.foodImagePlaceholder}>
                            <Ionicons name="restaurant" size={30} color={colors.textMuted} />
                        </View>
                    )}
                </View>

                <View style={styles.foodInfo}>
                    <View style={styles.foodHeader}>
                        <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.foodDesc} numberOfLines={2}>{item.description}</Text>
                    </View>

                    <View style={styles.foodMeta}>
                        <Text style={styles.foodPrice}>Rs. {item.price}</Text>
                        <View style={styles.ratingRow}>
                            <Ionicons name="star" size={12} color={colors.gold} />
                            <Text style={styles.ratingText}>{item.rating?.toFixed(1) || '0.0'}</Text>
                        </View>
                    </View>

                    <View style={styles.tagRow}>
                        {item.isVegetarian && (
                            <View style={[styles.tag, { backgroundColor: 'rgba(76,175,80,0.2)' }]}>
                                <Text style={[styles.tagText, { color: colors.mild }]}>Veg</Text>
                            </View>
                        )}

                        <View style={[styles.tag, { backgroundColor: `rgba(${item.spiceLevel === 'hot' ? '244,67,54' : '255,152,0'},0.15)` }]}>
                            <Text style={styles.tagText}>Spice: {item.spiceLevel}</Text>
                        </View>

                        <View style={styles.tag}>
                            <Text style={styles.tagText}>Prep: {item.preparationTime}min</Text>
                        </View>

                        {!item.isAvailable && (
                            <View style={[styles.tag, { backgroundColor: 'rgba(255,61,113,0.08)' }]}>
                                <Text style={[styles.tagText, { color: colors.danger }]}>Unavailable</Text>
                            </View>
                        )}

                        {hasDiscount && (
                            <View style={[styles.tag, { backgroundColor: 'rgba(255,193,7,0.08)' }]}>
                                <Text style={[styles.tagText, { color: colors.warning }]}>Discount</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderSortBar = () => (
        <View style={styles.sortBar}>
            <TouchableOpacity style={[styles.sortBtn, sortOption === 'newest' && styles.sortBtnActive]} onPress={() => setSortOption('newest')}>
                <Text style={styles.sortText}>Newest</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sortBtn, sortOption === 'popular' && styles.sortBtnActive]} onPress={() => setSortOption('popular')}>
                <Text style={styles.sortText}>Popular</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sortBtn, sortOption === 'price-asc' && styles.sortBtnActive]} onPress={() => setSortOption('price-asc')}>
                <Text style={styles.sortText}>Price ↑</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sortBtn, sortOption === 'price-desc' && styles.sortBtnActive]} onPress={() => setSortOption('price-desc')}>
                <Text style={styles.sortText}>Price ↓</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Menu</Text>
                <Text style={styles.subtitle}>{foods.length} dishes available</Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color={colors.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search dishes..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {renderSortBar()}

            <View style={styles.priceFilterRow}>
                <TextInput placeholder="Min" style={styles.priceInput} value={minPrice} onChangeText={setMinPrice} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                <Text style={{ marginHorizontal: 8 }}>—</Text>
                <TextInput placeholder="Max" style={styles.priceInput} value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                <TouchableOpacity style={styles.priceClear} onPress={() => { setMinPrice(''); setMaxPrice(''); }}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
            </View>

            {/* Food List */}
            {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
            <FlatList
                data={foods}
                keyExtractor={(item) => item._id}
                renderItem={renderFoodItem}
                contentContainerStyle={styles.foodList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="restaurant-outline" size={60} color={colors.textMuted} />
                        <Text style={styles.emptyText}>{loading ? 'Loading dishes...' : 'No dishes found'}</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingTop: 10 },
    title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassBg,
        borderWidth: 5, borderColor: colors.glassBorder, borderRadius: 1000,
        marginHorizontal: 20, marginTop: 14, paddingHorizontal: 16, height: 50,
    },
    searchInput: { flex: 1, marginLeft: 10, color: colors.textPrimary, fontSize: 15 },
    foodList: { paddingHorizontal: 16, paddingBottom: 100 },
    errorText: { fontSize: 13, color: colors.danger || '#E74C3C', marginHorizontal: 20, marginBottom: 8 },
    sortBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 8, marginBottom: 10 },
    sortBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder },
    sortBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    sortText: { color: colors.textSecondary, fontWeight: '700' },
    priceFilterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
    priceInput: { width: 80, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.textPrimary, backgroundColor: '#FFF' },
    priceClear: { marginLeft: 8 },
    foodCard: {
        flexDirection: 'row', backgroundColor: colors.glassBg,
        borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 18,
        marginBottom: 14, overflow: 'hidden',
        minHeight: 140,
    },
    foodImageWrap: { width: 120, height: 140 },
    foodImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    foodImagePlaceholder: {
        width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
        backgroundColor: colors.backgroundElevated,
    },
    foodInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
    foodHeader: {},
    foodName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    foodDesc: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    foodMeta: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 0,
    },
    foodPrice: { fontSize: 17, fontWeight: '800', color: colors.primary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ratingText: { fontSize: 12, color: colors.gold, fontWeight: '600' },
    tagRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
    tag: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 3,
    },
    tagText: { fontSize: 10, color: colors.textSecondary },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: colors.textMuted, fontSize: 16, marginTop: 12 },
});
