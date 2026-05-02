import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { API_BASE_URL } from '../../api/axios';
import colors from '../../styles/colors';

export default function ManageReviews() {
    const [reviews, setReviews] = useState([]);
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [filter, setFilter] = useState('all');

    useEffect(() => { fetchReviews(); }, []);

    const fetchReviews = async () => {
        try { const res = await api.get('/api/reviews'); setReviews(res.data.data || []); }
        catch (e) { console.error(e); }
    };

    const visibleReviews = reviews.filter((review) => {
        if (filter === 'high') return (review.overallRating || review.rating || 0) >= 4;
        if (filter === 'flagged') return review.isVisible === false;
        return true;
    });

    const handleReply = async (reviewId) => {
        if (!replyText.trim()) { Alert.alert('Error', 'Please enter a reply'); return; }
        try {
            await api.put(`/api/reviews/${reviewId}/reply`, { adminReply: replyText });
            setReplyingTo(null); setReplyText('');
            fetchReviews();
            Alert.alert('Success', 'Reply sent!');
        } catch (e) { Alert.alert('Error', 'Failed to send reply'); }
    };

    const handleDelete = (id) => {
        Alert.alert('Delete Review', 'Delete this review?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try { await api.delete(`/api/reviews/${id}`); fetchReviews(); }
                    catch (e) { Alert.alert('Error', 'Failed to delete'); }
                }
            },
        ]);
    };

    const handleHide = (review) => {
        Alert.alert('Hide Review', 'Mark this review as abusive/hidden?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Hide',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.put(`/api/reviews/${review._id}/hide`, { moderationReason: 'Hidden by admin' });
                        fetchReviews();
                    } catch (e) {
                        Alert.alert('Error', 'Failed to hide review');
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Reviews</Text>
                <Text style={styles.count}>{reviews.length} reviews</Text>
            </View>

            <View style={styles.filterRow}>
                {[
                    { key: 'all', label: 'All' },
                    { key: 'high', label: 'Top Rated' },
                    { key: 'flagged', label: 'Hidden' },
                ].map((item) => (
                    <TouchableOpacity key={item.key} style={[styles.filterChip, filter === item.key && styles.filterChipActive]} onPress={() => setFilter(item.key)}>
                        <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={visibleReviews}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <View style={styles.reviewCard}>
                        <View style={styles.reviewTop}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{item.user?.name?.[0] || 'U'}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.reviewerName}>{item.user?.name}</Text>
                                <Text style={styles.reviewFood}>{item.food?.name || 'Food Item'}</Text>
                            </View>
                            <View style={styles.ratingBadge}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <Ionicons key={s} name={s <= (item.overallRating || item.rating) ? 'star' : 'star-outline'} size={12} color={colors.gold} />
                                ))}
                            </View>
                        </View>
                        <Text style={styles.comment}>{item.comment}</Text>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricText}>Food {item.foodQuality}/5</Text>
                            <Text style={styles.metricText}>Delivery {item.deliverySpeed}/5</Text>
                            <Text style={styles.metricText}>Pack {item.packaging}/5</Text>
                            <Text style={styles.metricText}>Service {item.service}/5</Text>
                        </View>
                        {!!item.suggestions && <Text style={styles.suggestionText}>Suggestion: {item.suggestions}</Text>}
                        <Text style={styles.reviewDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>

                        {item.adminReply && (
                            <View style={styles.replyBox}>
                                <Text style={styles.replyLabel}>🏪 Your Reply:</Text>
                                <Text style={styles.replyText}>{item.adminReply}</Text>
                            </View>
                        )}

                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={styles.replyBtn}
                                onPress={() => { setReplyingTo(replyingTo === item._id ? null : item._id); setReplyText(item.adminReply || ''); }}
                            >
                                <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
                                <Text style={styles.replyBtnText}>{item.adminReply ? 'Edit Reply' : 'Reply'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.hideBtn} onPress={() => handleHide(item)}>
                                <Ionicons name="eye-off-outline" size={14} color={colors.warning} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteAction} onPress={() => handleDelete(item._id)}>
                                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                            </TouchableOpacity>
                        </View>

                        {item.photos?.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ marginTop: 10 }}>
                                {item.photos.map((photo) => (
                                    <Image key={photo} source={{ uri: `${API_BASE_URL}${photo}` }} style={styles.reviewPhoto} />
                                ))}
                            </ScrollView>
                        )}

                        {replyingTo === item._id && (
                            <View style={styles.replyForm}>
                                <TextInput
                                    style={styles.replyInput}
                                    value={replyText}
                                    onChangeText={setReplyText}
                                    placeholder="Write your reply..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                />
                                <TouchableOpacity style={styles.sendBtn} onPress={() => handleReply(item._id)}>
                                    <Ionicons name="send" size={18} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}><Ionicons name="chatbubbles-outline" size={50} color={colors.textMuted} /><Text style={styles.emptyText}>No reviews yet</Text></View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
    title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    count: { fontSize: 13, color: colors.textMuted },
    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
    filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
    filterTextActive: { color: '#FFF' },
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    reviewCard: { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 16, padding: 16, marginBottom: 12 },
    reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    reviewerName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    reviewFood: { fontSize: 11, color: colors.textMuted },
    ratingBadge: { flexDirection: 'row', gap: 2 },
    comment: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 10 },
    reviewDate: { fontSize: 10, color: colors.textMuted, marginTop: 6 },
    replyBox: { backgroundColor: 'rgba(255,107,53,0.08)', borderRadius: 10, padding: 10, marginTop: 10, borderLeftWidth: 3, borderLeftColor: colors.primary },
    replyLabel: { fontSize: 11, color: colors.primary, fontWeight: '700', marginBottom: 4 },
    replyText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    replyBtnText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    deleteAction: { padding: 4 },
    replyForm: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'flex-end' },
    replyInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 12, padding: 12, color: colors.textPrimary, fontSize: 13, maxHeight: 80 },
    sendBtn: { backgroundColor: colors.primary, borderRadius: 10, padding: 10 },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: colors.textMuted, marginTop: 8 },
    hideBtn: { padding: 4 },
    metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    metricText: { fontSize: 10, color: colors.primary, backgroundColor: 'rgba(255,107,53,0.08)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontWeight: '700' },
    suggestionText: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
    reviewPhoto: { width: 72, height: 72, borderRadius: 10, marginRight: 8 },
});
