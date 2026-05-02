import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../api/axios';
import colors from '../../styles/colors';

export default function PromotionsScreen({ navigation }) {
    const [promotions, setPromotions] = useState([]);

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }

        navigation.navigate('CustomerMain', { screen: 'Home' });
    };

    useEffect(() => {
        fetchPromotions();
    }, []);

    const fetchPromotions = async () => {
        try {
            const res = await api.get('/api/promotions');
            setPromotions(res.data.data || []);
        } catch (e) { console.error(e); }
    };

    const renderPromo = ({ item, index }) => (
        <View style={styles.promoCard}>
            <LinearGradient
                colors={index % 3 === 0 ? colors.gradientPrimary : index % 3 === 1 ? colors.gradientGold : colors.gradientSuccess}
                style={styles.promoGradient}
            >
                <View style={styles.promoContent}>
                    <Text style={styles.promoDiscount}>{item.discountPercentage}% OFF</Text>
                    <Text style={styles.promoTitle}>{item.title}</Text>
                    <Text style={styles.promoDesc}>{item.description}</Text>
                    <View style={styles.codeBox}>
                        <Text style={styles.codeLabel}>Promo Code</Text>
                        <Text style={styles.codeValue}>{item.code}</Text>
                    </View>
                    <Text style={styles.promoValidity}>
                        Valid: {new Date(item.validFrom).toLocaleDateString()} - {new Date(item.validUntil).toLocaleDateString()}
                    </Text>
                </View>
                <Ionicons name="pricetag" size={80} color="rgba(255,255,255,0.15)" style={styles.promoIcon} />
            </LinearGradient>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Promotions</Text>
            </View>
            <FlatList
                data={promotions}
                keyExtractor={(item) => item._id}
                renderItem={renderPromo}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="pricetag-outline" size={60} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No active promotions</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
    title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    promoCard: { marginBottom: 16, borderRadius: 20, overflow: 'hidden' },
    promoGradient: { padding: 24, borderRadius: 20, position: 'relative', minHeight: 180 },
    promoContent: {},
    promoDiscount: { fontSize: 36, fontWeight: '900', color: '#FFF' },
    promoTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginTop: 4 },
    promoDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 20 },
    codeBox: {
        backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 8, marginTop: 14, alignSelf: 'flex-start',
    },
    codeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
    codeValue: { fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: 2 },
    promoValidity: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 10 },
    promoIcon: { position: 'absolute', right: 16, bottom: 20 },
    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyText: { color: colors.textMuted, fontSize: 16, marginTop: 12 },
});
