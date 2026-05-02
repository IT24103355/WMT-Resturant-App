import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import api from '../../api/axios';
import { API_BASE_URL } from '../../api/axios';
import colors from '../../styles/colors';

export default function ManageCategories({ navigation }) {
    const [categories, setCategories] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState(null);
    const [existingImage, setExistingImage] = useState('');

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }

        navigation.navigate('AdminMain', { screen: 'Dashboard' });
    };

    useEffect(() => { fetchCategories(); }, []);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
        });

        if (!result.canceled) {
            setImage(result.assets[0]);
        }
    };

    const fetchCategories = async () => {
        try { const res = await api.get('/api/categories'); setCategories(res.data.data || []); }
        catch (e) { console.error(e); }
    };

    const handleSubmit = async () => {
        if (!name) { Alert.alert('Error', 'Category name is required'); return; }
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('description', description);

            if (image) {
                const fileName = image.uri.split('/').pop();
                const ext = fileName.split('.').pop();
                formData.append('image', {
                    uri: image.uri,
                    name: fileName,
                    type: `image/${ext}`,
                });
            }

            if (editingId) {
                await api.put(`/api/categories/${editingId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                await api.post('/api/categories', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            setName(''); setDescription(''); setEditingId(null); setShowForm(false);
            setImage(null);
            setExistingImage('');
            fetchCategories();
        } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed to save'); }
    };

    const handleEdit = (cat) => {
        setEditingId(cat._id);
        setName(cat.name);
        setDescription(cat.description || '');
        setExistingImage(cat.image || '');
        setImage(null);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        Alert.alert('Delete', 'Delete this category?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try { await api.delete(`/api/categories/${id}`); fetchCategories(); }
                    catch (e) { Alert.alert('Error', 'Failed to delete'); }
                }
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Categories</Text>
                <TouchableOpacity onPress={() => { setShowForm(!showForm); setEditingId(null); setName(''); setDescription(''); }}>
                    <Ionicons name={showForm ? 'close' : 'add'} size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {showForm && (
                <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 18 }} keyboardShouldPersistTaps="handled">
                    <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                        {image ? (
                            <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                        ) : existingImage ? (
                            <Image source={{ uri: `${API_BASE_URL}${existingImage}` }} style={styles.imagePreview} />
                        ) : (
                            <View style={styles.imagePlaceholder}>
                                <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                                <Text style={styles.imagePlaceholderText}>Tap to add category image</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Category Name" placeholderTextColor={colors.textMuted} />
                    <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} />
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
                        <LinearGradient colors={colors.gradientPrimary} style={styles.saveBtnGradient}>
                            <Text style={styles.saveBtnText}>{editingId ? 'Update' : 'Add'} Category</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            )}

            <FlatList
                data={categories}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <View style={styles.catCard}>
                        <View style={styles.catIcon}>
                            {item.image ? (
                                <Image source={{ uri: `${API_BASE_URL}${item.image}` }} style={styles.catImage} />
                            ) : (
                                <Ionicons name="grid" size={20} color={colors.primary} />
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.catName}>{item.name}</Text>
                            {item.description ? <Text style={styles.catDesc}>{item.description}</Text> : null}
                        </View>
                        <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
                            <Ionicons name="create-outline" size={18} color={colors.info} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.actionBtn}>
                            <Ionicons name="trash-outline" size={18} color={colors.danger} />
                        </TouchableOpacity>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
    title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    form: { paddingHorizontal: 20, marginBottom: 10 },
    imagePicker: {
        height: 170,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        backgroundColor: colors.backgroundLight,
        marginBottom: 12,
    },
    imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
    imagePlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    imagePlaceholderText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    input: { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 12, padding: 14, color: colors.textPrimary, fontSize: 15, marginBottom: 10 },
    saveBtn: { borderRadius: 12, overflow: 'hidden' },
    saveBtnGradient: { paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontWeight: '700' },
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    catCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 14, padding: 14, marginBottom: 8 },
    catIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,107,53,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    catImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    catName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    catDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    actionBtn: { padding: 8, marginLeft: 4 },
});
