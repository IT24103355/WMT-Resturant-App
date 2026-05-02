import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Alert, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as Linking from 'expo-linking';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import api, { API_BASE_URL } from '../../api/axios';
import colors from '../../styles/colors';

WebBrowser.maybeCompleteAuthSession();

export default function CartScreen({ navigation }) {
    const { cartItems, updateQuantity, removeFromCart, clearCart, getTotal } = useCart();
    const { user } = useAuth();
    const tabBarHeight = useBottomTabBarHeight();
    const [paymentMethod, setPaymentMethod] = useState('card');
    const [processingPayment, setProcessingPayment] = useState(false);
    const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '');
    const [deliveryLocation, setDeliveryLocation] = useState(null);
    const [specialInstructions, setSpecialInstructions] = useState('');
    const [specialRequestFiles, setSpecialRequestFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [fetchingLocation, setFetchingLocation] = useState(false);
    const [mapRegion, setMapRegion] = useState({
        latitude: 6.9271,
        longitude: 79.8612,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
    });

    const paymentOptions = [
        { key: 'cash', label: 'Cash on Delivery', icon: 'cash-outline', description: 'Pay after receiving your order' },
        { key: 'card', label: 'Card Payment', icon: 'card-outline', description: 'Secure checkout with Visa or MasterCard' },
        { key: 'online', label: 'Online Transfer', icon: 'swap-horizontal-outline', description: 'Transfer from your bank app and keep the receipt' },
    ];

    const normalizePickedFile = (asset) => {
        const name = asset.name || asset.fileName || asset.uri.split('/').pop() || `attachment-${Date.now()}`;
        const lowerName = name.toLowerCase();
        const isPdf = lowerName.endsWith('.pdf') || asset.mimeType === 'application/pdf';
        const mimeType = asset.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg');
        return {
            uri: asset.uri,
            name,
            mimeType,
            kind: isPdf ? 'pdf' : 'image',
        };
    };

    const pickSpecialImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow photo access to add a special request image.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.85,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
            setSpecialRequestFiles((current) => [...current, normalizePickedFile(result.assets[0])].slice(0, 5));
        }
    };

    const pickSpecialPdf = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: 'application/pdf',
            copyToCacheDirectory: true,
            multiple: false,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
            setSpecialRequestFiles((current) => [...current, normalizePickedFile(result.assets[0])].slice(0, 5));
        }
    };

    const removeSpecialRequestFile = (uri) => {
        setSpecialRequestFiles((current) => current.filter((item) => item.uri !== uri));
    };

    useEffect(() => {
        // Card checkout is always available in the app UI.
    }, []);

    useEffect(() => {
        setDeliveryAddress(user?.address || '');
    }, [user?.address]);

    const subtotal = getTotal();
    const discountAmount = appliedCoupon ? (subtotal * (appliedCoupon.discountPercentage || 0) / 100) : 0;
    const TAX_RATE = 0.08;
    const DELIVERY_FEE = 60;
    const taxAmount = (subtotal - discountAmount) * TAX_RATE;
    const grandTotal = Math.max(0, subtotal - discountAmount + taxAmount + DELIVERY_FEE);

    const handleUseCurrentLocation = async () => {
        try {
            setFetchingLocation(true);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please allow location access to use current location for delivery.');
                return;
            }

            const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = current.coords;

            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
            setDeliveryLocation({ latitude, longitude, mapUrl });
            setMapRegion((prev) => ({ ...prev, latitude, longitude }));

            const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (reverse && reverse.length > 0) {
                const item = reverse[0];
                const parts = [item.name, item.street, item.city, item.region, item.country].filter(Boolean);
                setDeliveryAddress(parts.join(', '));
            } else {
                setDeliveryAddress(`Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`);
            }
        } catch (error) {
            Alert.alert('Location Error', 'Unable to get your location. Please enter address manually.');
        } finally {
            setFetchingLocation(false);
        }
    };

    const updateAddressFromCoordinates = async (latitude, longitude) => {
        try {
            const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (reverse && reverse.length > 0) {
                const item = reverse[0];
                const parts = [item.name, item.street, item.city, item.region, item.country].filter(Boolean);
                setDeliveryAddress(parts.join(', '));
            } else {
                setDeliveryAddress(`Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`);
            }
        } catch (_) {
            setDeliveryAddress(`Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`);
        }
    };

    const handleMapPress = async (event) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        setDeliveryLocation({ latitude, longitude, mapUrl });
        setMapRegion((prev) => ({ ...prev, latitude, longitude }));
        await updateAddressFromCoordinates(latitude, longitude);
    };

    const handleMarkerDragEnd = async (event) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        setDeliveryLocation({ latitude, longitude, mapUrl });
        setMapRegion((prev) => ({ ...prev, latitude, longitude }));
        await updateAddressFromCoordinates(latitude, longitude);
    };

    const openInGoogleMaps = async () => {
        if (!deliveryLocation?.latitude || !deliveryLocation?.longitude) {
            Alert.alert('No location yet', 'Tap "Use Current Location" first.');
            return;
        }

        try {
            await Linking.openURL(deliveryLocation.mapUrl);
        } catch (_) {
            Alert.alert('Error', 'Could not open Google Maps.');
        }
    };

    const applyCoupon = async () => {
        if (!couponCode || couponCode.trim().length === 0) {
            Alert.alert('Coupon', 'Please enter a coupon code');
            return;
        }

        try {
            const res = await api.get('/api/promotions');
            const promos = res.data.data || [];
            const found = promos.find((p) => String(p.code || '').toLowerCase() === couponCode.trim().toLowerCase());
            if (!found) {
                Alert.alert('Invalid Coupon', 'Coupon code not found or expired');
                setAppliedCoupon(null);
                return;
            }
            setAppliedCoupon(found);
            Alert.alert('Coupon Applied', `${found.title} - ${found.discountPercentage}% off`);
        } catch (error) {
            Alert.alert('Error', 'Failed to validate coupon. Try again');
        }
    };

    const clearCoupon = () => {
        setCouponCode('');
        setAppliedCoupon(null);
    };

    const hasSpecialRequestFiles = specialRequestFiles.length > 0;

    const buildOrderPayload = (finalTotal, subtotal, discount, tax) => {
        const base = {
            items: cartItems.map((item) => ({
                food: item._id,
                name: item.name,
                image: item.image,
                quantity: item.quantity,
                price: item.price,
            })),
            subtotal,
            discount: Number(discount.toFixed(2)),
            tax: Number(tax.toFixed(2)),
            deliveryFee: Number(DELIVERY_FEE.toFixed(2)),
            totalAmount: Number(finalTotal.toFixed(2)),
            couponCode: appliedCoupon?.code || null,
            specialInstructions,
            deliveryAddress: deliveryAddress || user?.address || 'Pick up',
            deliveryLocation: deliveryLocation || { latitude: null, longitude: null, mapUrl: '' },
            paymentMethod,
        };

        if (!hasSpecialRequestFiles) {
            return { payload: base, isMultipart: false };
        }

        const formData = new FormData();
        Object.entries(base).forEach(([key, value]) => {
            if (key === 'items' || key === 'deliveryLocation') {
                formData.append(key, JSON.stringify(value));
            } else if (value !== null && value !== undefined) {
                formData.append(key, String(value));
            }
        });

        specialRequestFiles.forEach((file, index) => {
            const extension = file.kind === 'pdf' ? 'pdf' : (file.name.split('.').pop() || 'jpg');
            formData.append('specialRequestImages', {
                uri: file.uri,
                name: file.name || `special-request-${index + 1}.${extension}`,
                type: file.mimeType || (file.kind === 'pdf' ? 'application/pdf' : 'image/jpeg'),
            });
        });

        return { payload: formData, isMultipart: true };
    };

    const handlePlaceOrder = async () => {
        if (cartItems.length === 0) {
            Alert.alert('Empty Cart', 'Please add items to your cart first');
            return;
        }

        if (!user) {
            Alert.alert('Login Required', 'Please login or sign up to place an order', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Login', onPress: () => navigation.navigate('Login') },
            ]);
            return;
        }

        try {
            setProcessingPayment(true);

            const subtotal = getTotal();
            const discount = appliedCoupon ? (subtotal * (appliedCoupon.discountPercentage || 0) / 100) : 0;
            const TAX_RATE = 0.08; // 8%
            const DELIVERY_FEE = 60; // flat fee
            const tax = (subtotal - discount) * TAX_RATE;
            const finalTotal = Math.max(0, subtotal - discount + tax + DELIVERY_FEE);

            const { payload: orderData, isMultipart } = buildOrderPayload(finalTotal, subtotal, discount, tax);
            const orderResponse = await api.post('/api/orders', orderData, isMultipart ? {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (event) => {
                    if (event.total) {
                        setUploadProgress(Math.round((event.loaded * 100) / event.total));
                    }
                },
            } : undefined);
            const createdOrder = orderResponse.data.data;
            setSpecialRequestFiles([]);
            setUploadProgress(0);

            if (paymentMethod === 'card') {
                const configResponse = await api.get('/api/payments/config');
                const cardEnabled = !!configResponse.data?.data?.cardEnabled;

                if (cardEnabled) {
                    const returnUrl = Linking.createURL('payment-return');
                    const sessionResponse = await api.post('/api/payments/stripe/create-checkout-session', {
                        orderId: createdOrder._id,
                        returnUrl,
                    });

                    const checkoutUrl = sessionResponse.data.data.checkoutUrl;
                    const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, returnUrl);

                    if (result.type === 'success' && result.url) {
                        const parsed = Linking.parse(result.url);
                        const sessionId = parsed.queryParams?.session_id;

                        if (sessionId) {
                            const verifyResponse = await api.get(`/api/payments/stripe/verify/${sessionId}`);
                            if (verifyResponse.data.success && verifyResponse.data.data.paymentStatus === 'paid') {
                                clearCart();
                                Alert.alert('Payment Successful', 'Your card payment was completed successfully');
                                navigation.navigate('Orders');
                                return;
                            }
                        }
                    }

                    Alert.alert(
                        'Payment Incomplete',
                        'Please complete the card payment in the browser and return to the app. You can refresh Orders afterward.'
                    );
                    return;
                }

                await api.post(`/api/payments/simulate/confirm/${createdOrder._id}`);
                clearCart();
                Alert.alert('Payment Successful', 'Card payment is available in the app and the order was confirmed successfully');
                navigation.navigate('Orders');
                return;
            }

            if (paymentMethod === 'online') {
                clearCart();
                navigation.navigate('PaymentMethod', {
                    amount: finalTotal,
                    billingAddress: deliveryAddress,
                    cardholderName: user?.name,
                    selectedMethod: 'online',
                    orderId: createdOrder._id,
                });
                return;
            }

            clearCart();

            Alert.alert('Order Placed! 🎉', 'Your cash on delivery order has been placed successfully');

            navigation.navigate('Orders');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to place order');
        } finally {
            setProcessingPayment(false);
        }
    };

    const renderCartItem = ({ item }) => (
        <View style={styles.cartItem}>
            <View style={styles.itemImageWrap}>
                {item.image ? (
                    <Image source={{ uri: `${API_BASE_URL}${item.image}` }} style={styles.itemImage} />
                ) : (
                    <View style={styles.itemImagePlaceholder}>
                        <Ionicons name="restaurant" size={24} color={colors.textMuted} />
                    </View>
                )}
            </View>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemPrice}>Rs. {item.price}</Text>
            </View>
            <View style={styles.quantityControl}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item._id, item.quantity - 1)}>
                    <Ionicons name="remove" size={16} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item._id, item.quantity + 1)}>
                    <Ionicons name="add" size={16} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => removeFromCart(item._id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>My Cart</Text>
                {cartItems.length > 0 && (
                    <TouchableOpacity onPress={clearCart}>
                        <Text style={styles.clearText}>Clear All</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={cartItems}
                keyExtractor={(item) => item._id}
                renderItem={renderCartItem}
                contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 260 }]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="cart-outline" size={80} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>Your cart is empty</Text>
                        <Text style={styles.emptySubtitle}>Add some delicious Sri Lankan dishes!</Text>
                        <TouchableOpacity style={styles.browseButton} onPress={() => navigation.navigate('Menu')}>
                            <Text style={styles.browseText}>Browse Menu</Text>
                        </TouchableOpacity>
                    </View>
                }
            />

            {cartItems.length > 0 && (
                <View style={[styles.bottomSection, { bottom: tabBarHeight + 8 }] }>
                    <Text style={styles.sectionTitle}>Delivery Location</Text>
                    <View style={styles.locationCard}>
                        <TextInput
                            style={styles.locationInput}
                            value={deliveryAddress}
                            onChangeText={setDeliveryAddress}
                            placeholder="Enter delivery address"
                            placeholderTextColor={colors.textMuted}
                            multiline
                        />
                        <MapView
                            style={styles.locationMap}
                            region={mapRegion}
                            onPress={handleMapPress}
                        >
                            <Marker
                                coordinate={
                                    deliveryLocation
                                        ? { latitude: deliveryLocation.latitude, longitude: deliveryLocation.longitude }
                                        : { latitude: mapRegion.latitude, longitude: mapRegion.longitude }
                                }
                                draggable
                                onDragEnd={handleMarkerDragEnd}
                                title="Delivery location"
                            />
                        </MapView>
                        <Text style={styles.mapHint}>Tap map to set location or drag the pin to adjust</Text>
                        <View style={styles.locationActions}>
                            <TouchableOpacity style={styles.locationBtn} onPress={handleUseCurrentLocation} disabled={fetchingLocation}>
                                <Ionicons name="locate-outline" size={16} color={colors.primary} />
                                <Text style={styles.locationBtnText}>{fetchingLocation ? 'Locating...' : 'Use Current Location'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.locationBtn} onPress={openInGoogleMaps}>
                                <Ionicons name="map-outline" size={16} color={colors.primary} />
                                <Text style={styles.locationBtnText}>Open in Google Maps</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.paymentHeaderRow}>
                        <Text style={styles.paymentTitle}>Payment Method</Text>
                        <TouchableOpacity
                            style={styles.paymentScreenButton}
                            onPress={() => navigation.navigate('PaymentMethod', {
                                amount: grandTotal,
                                billingAddress: deliveryAddress,
                                cardholderName: user?.name,
                            })}
                        >
                            <Text style={styles.paymentScreenButtonText}>Open detailed screen</Text>
                            <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.paymentGrid}>
                        {paymentOptions.map((option) => {
                            const isActive = paymentMethod === option.key;
                            const isDisabled = false;
                            return (
                                <TouchableOpacity
                                    key={option.key}
                                    style={[styles.paymentCard, isActive && styles.paymentCardActive, isDisabled && styles.paymentCardDisabled]}
                                    onPress={() => {
                                        setPaymentMethod(option.key);
                                    }}
                                >
                                    <View style={[styles.paymentIconWrap, isActive && styles.paymentIconWrapActive]}>
                                        <Ionicons name={option.icon} size={18} color={isActive ? '#FFF' : isDisabled ? colors.textMuted : colors.primary} />
                                    </View>
                                    <Text style={[styles.paymentLabel, isActive && styles.paymentLabelActive, isDisabled && { color: colors.textMuted }]}>{option.label}</Text>
                                    <Text style={[styles.paymentDesc, isDisabled && { color: colors.textMuted }]}>{option.description}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.couponRow}>
                        <TextInput
                            placeholder="Have a coupon code?"
                            placeholderTextColor={colors.textMuted}
                            style={styles.couponInput}
                            value={couponCode}
                            onChangeText={setCouponCode}
                        />
                        <TouchableOpacity style={styles.couponApplyBtn} onPress={applyCoupon}>
                            <Text style={styles.couponApplyText}>Apply</Text>
                        </TouchableOpacity>
                        {appliedCoupon && (
                            <TouchableOpacity style={styles.couponClearBtn} onPress={clearCoupon}>
                                <Text style={styles.couponClearText}>Clear</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Special Instructions</Text>
                    <TextInput
                        style={styles.instructionsInput}
                        placeholder="e.g., extra spicy, no onions, less salt, packaging requests"
                        placeholderTextColor={colors.textMuted}
                        value={specialInstructions}
                        onChangeText={setSpecialInstructions}
                        multiline
                        numberOfLines={2}
                    />

                    <View style={styles.specialRequestCard}>
                        <View style={styles.specialRequestHeader}>
                            <Text style={styles.sectionTitle}>Special Request Files</Text>
                            <Text style={styles.specialRequestHint}>JPG, PNG, PDF</Text>
                        </View>
                        <Text style={styles.specialRequestSubtext}>Upload a reference photo, allergy note, or presentation example.</Text>
                        <View style={styles.specialRequestActions}>
                            <TouchableOpacity style={styles.uploadActionBtn} onPress={pickSpecialImage}>
                                <Ionicons name="image-outline" size={16} color="#FFF" />
                                <Text style={styles.uploadActionText}>Add Image</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.uploadActionBtn} onPress={pickSpecialPdf}>
                                <Ionicons name="document-text-outline" size={16} color="#FFF" />
                                <Text style={styles.uploadActionText}>Add PDF</Text>
                            </TouchableOpacity>
                        </View>
                        {hasSpecialRequestFiles ? (
                            <View style={styles.previewGrid}>
                                {specialRequestFiles.map((file) => (
                                    <View key={file.uri} style={styles.previewCard}>
                                        {file.kind === 'pdf' ? (
                                            <View style={[styles.pdfPreview, { width: '100%', height: 120 }]}>
                                                <Ionicons name="document-text-outline" size={34} color={colors.primary} />
                                                <Text style={styles.previewFileName} numberOfLines={2}>{file.name}</Text>
                                                <Text style={styles.previewFileType}>PDF</Text>
                                            </View>
                                        ) : (
                                            <Image source={{ uri: file.uri }} style={styles.previewImage} />
                                        )}
                                        <View style={styles.previewActionsRow}>
                                            <Text style={styles.previewFileName} numberOfLines={1}>{file.name}</Text>
                                            <TouchableOpacity onPress={() => removeSpecialRequestFile(file.uri)}>
                                                <Text style={styles.previewRemoveText}>Remove</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.previewEmpty}>
                                <Ionicons name="cloud-upload-outline" size={18} color={colors.textMuted} />
                                <Text style={styles.previewEmptyText}>No files selected yet</Text>
                            </View>
                        )}
                        {uploadProgress > 0 && uploadProgress < 100 && (
                            <View style={styles.progressWrap}>
                                <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                            </View>
                        )}
                        <Text style={styles.progressText}>{uploadProgress > 0 ? `${uploadProgress}% ready to send` : 'You can add, remove, or change files before placing the order.'}</Text>
                    </View>

                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Subtotal</Text>
                            <Text style={styles.summaryValue}>Rs. {subtotal.toFixed(2)}</Text>
                        </View>
                        {appliedCoupon && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Discount ({appliedCoupon.discountPercentage}%)</Text>
                                <Text style={[styles.summaryValue, { color: colors.success }]}>- Rs. {discountAmount.toFixed(2)}</Text>
                            </View>
                        )}
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Tax</Text>
                            <Text style={styles.summaryValue}>Rs. {taxAmount.toFixed(2)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Delivery</Text>
                            <Text style={styles.summaryValue}>Rs. {DELIVERY_FEE.toFixed(2)}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.totalValue}>Rs. {grandTotal.toFixed(2)}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={[styles.orderButton, processingPayment && { opacity: 0.7 }]} onPress={handlePlaceOrder} disabled={processingPayment}>
                        <LinearGradient colors={colors.gradientPrimary} style={styles.orderGradient}>
                            <Text style={styles.orderButtonText}>{processingPayment ? 'Processing...' : paymentMethod === 'card' ? 'Pay by Card' : paymentMethod === 'online' ? 'Continue to Transfer' : 'Confirm Order'}</Text>
                            <Ionicons name="arrow-forward" size={20} color="#FFF" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10,
    },
    title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
    clearText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
    listContent: { paddingHorizontal: 16, paddingBottom: 280 },
    cartItem: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassBg,
        borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 16,
        padding: 12, marginBottom: 12,
    },
    itemImageWrap: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden' },
    itemImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    itemImagePlaceholder: {
        width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
        backgroundColor: colors.backgroundElevated,
    },
    itemInfo: { flex: 1, marginLeft: 12 },
    itemName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    itemPrice: { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: 4 },
    quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    qtyBtn: {
        width: 30, height: 30, borderRadius: 8,
        backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
        justifyContent: 'center', alignItems: 'center',
    },
    qtyText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, minWidth: 20, textAlign: 'center' },
    deleteBtn: { marginLeft: 10, padding: 4 },
    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 20 },
    emptySubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
    browseButton: {
        backgroundColor: colors.primary, borderRadius: 14,
        paddingHorizontal: 28, paddingVertical: 12, marginTop: 24,
    },
    browseText: { color: '#FFF', fontWeight: '700' },
    bottomSection: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: colors.backgroundLight, borderTopWidth: 1, borderTopColor: colors.glassBorder,
        padding: 20,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 8,
    },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
    locationCard: {
        backgroundColor: '#FAFAFC',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 14,
        padding: 10,
        marginBottom: 14,
    },
    locationInput: {
        minHeight: 46,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: colors.textPrimary,
        fontSize: 13,
        backgroundColor: '#FFF',
        textAlignVertical: 'top',
    },
    locationActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    locationMap: {
        height: 160,
        borderRadius: 12,
        marginTop: 10,
        overflow: 'hidden',
    },
    mapHint: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 8,
    },
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: 'rgba(122,30,44,0.25)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: 'rgba(122,30,44,0.06)',
    },
    locationBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
    paymentHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    paymentTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    paymentScreenButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(122,30,44,0.18)',
        backgroundColor: 'rgba(122,30,44,0.06)',
    },
    paymentScreenButtonText: { fontSize: 11, fontWeight: '700', color: colors.primary },
    paymentGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    paymentCard: {
        flex: 1,
        backgroundColor: '#FAFAFC',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 14,
        padding: 10,
    },
    paymentCardActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    paymentCardDisabled: {
        opacity: 0.65,
    },
    paymentIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(122,30,44,0.1)',
        marginBottom: 8,
    },
    paymentIconWrapActive: { backgroundColor: 'rgba(255,255,255,0.16)' },
    paymentLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
    paymentLabelActive: { color: '#FFF' },
    paymentDesc: { fontSize: 10, color: colors.textMuted, marginTop: 3, lineHeight: 13 },
    specialRequestCard: {
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 18,
        padding: 14,
        marginBottom: 14,
    },
    specialRequestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    specialRequestHint: { fontSize: 11, fontWeight: '800', color: colors.info },
    specialRequestSubtext: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 10, lineHeight: 18 },
    specialRequestActions: { flexDirection: 'row', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
    uploadActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
    uploadActionText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
    previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    previewCard: { width: '48%', borderRadius: 14, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: '#FFF', overflow: 'hidden' },
    previewImage: { width: '100%', height: 120, backgroundColor: '#E2E8F0' },
    pdfPreview: { justifyContent: 'center', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC' },
    previewActionsRow: { padding: 10, gap: 8 },
    previewFileName: { fontSize: 11, fontWeight: '700', color: colors.textPrimary },
    previewFileType: { marginTop: 4, fontSize: 10, fontWeight: '800', color: colors.info },
    previewRemoveText: { color: colors.danger, fontSize: 11, fontWeight: '800' },
    previewEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
    previewEmptyText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    progressWrap: { height: 8, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.08)', overflow: 'hidden', marginTop: 6 },
    progressBar: { height: '100%', backgroundColor: colors.primary },
    progressText: { marginTop: 6, fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    summaryCard: { marginBottom: 16 },
    couponRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    couponInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        color: colors.textPrimary,
        backgroundColor: '#FFF',
        fontSize: 13,
    },
    couponApplyBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
    },
    couponApplyText: { color: '#FFF', fontWeight: '700' },
    couponClearBtn: { marginLeft: 6, paddingHorizontal: 10, paddingVertical: 8 },
    couponClearText: { color: colors.textMuted, fontWeight: '700' },
    instructionsInput: {
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        color: colors.textPrimary,
        fontSize: 13,
        backgroundColor: '#FFF',
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    summaryLabel: { color: colors.textMuted, fontSize: 14 },
    summaryValue: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    divider: { height: 1, backgroundColor: colors.glassBorder, marginVertical: 8 },
    totalLabel: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
    totalValue: { color: colors.primary, fontSize: 22, fontWeight: '900' },
    orderButton: { borderRadius: 16, overflow: 'hidden' },
    orderGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, gap: 8,
    },
    orderButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
