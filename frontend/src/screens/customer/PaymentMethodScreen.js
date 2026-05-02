import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Image,
    useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../api/axios';
import colors from '../../styles/colors';
import { useAuth } from '../../context/AuthContext';

const paymentOptions = [
    {
        key: 'cash',
        label: 'Cash on Delivery',
        description: 'Pay after your food arrives',
        icon: 'cash-outline',
        tone: '#D97706',
    },
    {
        key: 'card',
        label: 'Card Payment',
        description: 'Secure debit or credit card checkout',
        icon: 'card-outline',
        tone: colors.primary,
    },
    {
        key: 'online',
        label: 'Online Transfer',
        description: 'Transfer from your bank app and keep the receipt',
        icon: 'swap-horizontal-outline',
        tone: colors.info,
    },
];

const trustBadges = [
    { icon: 'shield-checkmark-outline', label: 'SSL Encrypted' },
    { icon: 'lock-closed-outline', label: 'Secure Gateway' },
    { icon: 'checkmark-done-outline', label: 'Trusted Checkout' },
];

const bankTransferDetails = [
    { label: 'Bank Name', value: 'Commercial Bank of Lagoon' },
    { label: 'Account Name', value: 'Dine Wave Foods (Pvt) Ltd' },
    { label: 'Account Number', value: '012345678901' },
    { label: 'Branch', value: 'Colombo Main' },
];

const initialForm = {
    cardholderName: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    billingAddress: '',
};

const initialTouched = {
    cardholderName: false,
    cardNumber: false,
    expiryDate: false,
    cvv: false,
    billingAddress: false,
};

const detectCardBrand = (digits) => {
    if (/^4\d{0,15}$/.test(digits)) return 'Visa';
    if (/^(5[1-5]\d{0,14}|2(2[2-9]\d{0,13}|[3-6]\d{0,14}|7[01]\d{0,13}|720\d{0,12}))$/.test(digits)) return 'MasterCard';
    return '';
};

const formatCardNumber = (value) => value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

const formatExpiryDate = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const getExpiryError = (value) => {
    if (!value) return 'Expiry date is required';
    if (!/^\d{2}\/\d{2}$/.test(value)) return 'Use MM/YY format';

    const [monthText, yearText] = value.split('/');
    const month = Number(monthText);
    const year = 2000 + Number(yearText);

    if (month < 1 || month > 12) return 'Enter a valid month';

    const current = new Date();
    const expiry = new Date(year, month, 0, 23, 59, 59, 999);
    if (expiry < current) return 'Card has expired';

    return '';
};

const validateForm = (form, selectedMethod) => {
    const nextErrors = {};
    const cardDigits = form.cardNumber.replace(/\s/g, '');

    if (selectedMethod === 'card') {
        if (!form.cardholderName.trim()) nextErrors.cardholderName = 'Cardholder name is required';
        else if (form.cardholderName.trim().length < 2) nextErrors.cardholderName = 'Enter the full cardholder name';

        if (!cardDigits) nextErrors.cardNumber = 'Card number is required';
        else if (!/^\d{16}$/.test(cardDigits)) nextErrors.cardNumber = 'Card number must contain exactly 16 digits';

        const expiryError = getExpiryError(form.expiryDate);
        if (expiryError) nextErrors.expiryDate = expiryError;

        if (!form.cvv) nextErrors.cvv = 'CVV is required';
        else if (!/^\d{3}$/.test(form.cvv)) nextErrors.cvv = 'CVV must be 3 digits';

        if (!form.billingAddress.trim()) nextErrors.billingAddress = 'Billing address is required';
        else if (form.billingAddress.trim().length < 6) nextErrors.billingAddress = 'Enter a complete billing address';
    }

    return nextErrors;
};

const getMethodCopy = (method) => {
    switch (method) {
        case 'cash':
            return {
                title: 'Cash on Delivery',
                description: 'Your order will be confirmed now and paid in cash when it arrives.',
                detail: 'Keep the exact amount ready for a fast handoff.',
            };
        case 'online':
            return {
                title: 'Online Transfer',
                description: 'Send the payment using your banking app and save the transfer receipt.',
                detail: 'A receipt reference will be generated after payment so you can keep proof of transfer.',
            };
        default:
            return {
                title: 'Card Payment',
                description: 'Enter your card details below for an encrypted payment flow.',
                detail: 'Visa and MasterCard are supported with live validation.',
            };
    }
};

export default function PaymentMethodScreen({ navigation, route }) {
    const { user } = useAuth();
    const { width } = useWindowDimensions();
    const [selectedMethod, setSelectedMethod] = useState(route?.params?.selectedMethod || 'card');
    const [form, setForm] = useState(initialForm);
    const [touched, setTouched] = useState(initialTouched);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [successVisible, setSuccessVisible] = useState(false);
    const [successReference, setSuccessReference] = useState('');
    const [receiptAsset, setReceiptAsset] = useState(null);

    const amount = route?.params?.amount;
    const billingAddressFromRoute = route?.params?.billingAddress || user?.address || '';
    const cardholderFromRoute = route?.params?.cardholderName || user?.name || '';
    const orderId = route?.params?.orderId || null;

    useEffect(() => {
        setForm((current) => ({
            ...current,
            cardholderName: current.cardholderName || cardholderFromRoute,
            billingAddress: current.billingAddress || billingAddressFromRoute,
        }));
    }, [billingAddressFromRoute, cardholderFromRoute]);

    const cardDigits = form.cardNumber.replace(/\s/g, '');
    const cardBrand = detectCardBrand(cardDigits);
    const cardCopy = getMethodCopy(selectedMethod);
    const methodColor = paymentOptions.find((item) => item.key === selectedMethod)?.tone || colors.primary;
    const successTitle = selectedMethod === 'online' ? 'Receipt uploaded' : 'Payment confirmed';
    const successMessage = selectedMethod === 'online'
        ? 'Your transfer receipt has been uploaded and is awaiting verification.'
        : `${paymentOptions.find((item) => item.key === selectedMethod)?.label} completed successfully.`;

    const fieldState = useMemo(() => ({
        cardholderName: !!form.cardholderName.trim() && form.cardholderName.trim().length >= 2,
        cardNumber: /^\d{16}$/.test(cardDigits),
        expiryDate: !getExpiryError(form.expiryDate),
        cvv: /^\d{3}$/.test(form.cvv),
        billingAddress: !!form.billingAddress.trim() && form.billingAddress.trim().length >= 6,
    }), [cardBrand, cardDigits, form.billingAddress, form.cardholderName, form.cvv, form.expiryDate]);

    const visibleErrors = (fieldName) => (touched[fieldName] ? errors[fieldName] : '');

    const syncErrors = (nextForm, method = selectedMethod) => {
        const nextErrors = validateForm(nextForm, method);
        setErrors(nextErrors);
        return nextErrors;
    };

    const handleChange = (fieldName, value) => {
        let nextValue = value;
        if (fieldName === 'cardNumber') nextValue = formatCardNumber(value);
        if (fieldName === 'expiryDate') nextValue = formatExpiryDate(value);
        if (fieldName === 'cvv') nextValue = value.replace(/\D/g, '').slice(0, 3);

        setForm((current) => {
            const nextForm = { ...current, [fieldName]: nextValue };
            syncErrors(nextForm);
            return nextForm;
        });
    };

    const handleBlur = (fieldName) => {
        setTouched((current) => ({ ...current, [fieldName]: true }));
        syncErrors(form);
    };

    const pickReceipt = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission required', 'Please allow photo access to upload your transfer receipt.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
            setReceiptAsset(result.assets[0]);
        }
    };

    const markAllTouched = () => {
        setTouched({
            cardholderName: true,
            cardNumber: true,
            expiryDate: true,
            cvv: true,
            billingAddress: true,
        });
    };

    const handlePayNow = async () => {
        markAllTouched();
        const nextErrors = syncErrors(form);

        if (selectedMethod === 'card' && Object.keys(nextErrors).length > 0) return;

        if (selectedMethod === 'online') {
            if (!orderId) {
                Alert.alert('Missing order', 'Please place the order from the cart first, then upload the transfer receipt.');
                return;
            }

            if (!receiptAsset?.uri) {
                Alert.alert('Receipt required', 'Please upload a transfer receipt photo first.');
                return;
            }
        }

        setLoading(true);
        try {
            if (selectedMethod === 'online') {
                const formData = new FormData();
                const uri = receiptAsset.uri;
                const fileName = receiptAsset.fileName || `receipt-${Date.now()}.jpg`;
                const fileType = receiptAsset.mimeType || 'image/jpeg';
                formData.append('receipt', {
                    uri: uri.startsWith('file://') ? uri : uri,
                    name: fileName,
                    type: fileType,
                });

                const res = await api.post(`/api/payments/online-transfer/${orderId}/receipt`, formData);
                setSuccessReference(res.data.data?.invoiceNumber || res.data.data?.paymentReference || `TRF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
            } else {
                await new Promise((resolve) => setTimeout(resolve, 1300));
                setSuccessReference(`PMT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
            }
            setSuccessVisible(true);
        } finally {
            setLoading(false);
        }
    };

    const handleSuccessContinue = () => {
        setSuccessVisible(false);
        navigation.navigate('CustomerMain', { screen: 'Orders' });
    };

    const renderInput = (fieldName, label, placeholder, keyboardType = 'default', extraProps = {}) => (
        <View style={styles.fieldGroup}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.inputShell, visibleErrors(fieldName) && styles.inputShellError]}>
                <TextInput
                    value={form[fieldName]}
                    onChangeText={(value) => handleChange(fieldName, value)}
                    onBlur={() => handleBlur(fieldName)}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={keyboardType}
                    style={[styles.input, extraProps.multiline && styles.multilineInput]}
                    multiline={extraProps.multiline}
                    numberOfLines={extraProps.numberOfLines}
                    maxLength={extraProps.maxLength}
                    textAlignVertical={extraProps.multiline ? 'top' : 'center'}
                    autoCapitalize={extraProps.autoCapitalize || 'none'}
                />
                {fieldState[fieldName] ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} style={styles.inputStatusIcon} />
                ) : visibleErrors(fieldName) ? (
                    <Ionicons name="alert-circle" size={20} color={colors.danger} style={styles.inputStatusIcon} />
                ) : null}
            </View>
            {!!visibleErrors(fieldName) && <Text style={styles.errorText}>{visibleErrors(fieldName)}</Text>}
            {!visibleErrors(fieldName) && fieldState[fieldName] && <Text style={styles.successText}>Looks good</Text>}
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.content, { paddingBottom: width > 420 ? 44 : 28 }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <LinearGradient colors={colors.gradientPrimary} style={styles.heroCard}>
                        <View style={styles.heroTopRow}>
                            <View>
                                <Text style={styles.heroEyebrow}>SECURE CHECKOUT</Text>
                                <Text style={styles.heroTitle}>Payment Method</Text>
                                <Text style={styles.heroSubtitle}>Choose how you want to pay and complete checkout safely.</Text>
                            </View>
                            <View style={styles.heroIconWrap}>
                                <Ionicons name="shield-checkmark" size={26} color="#FFF" />
                            </View>
                        </View>

                        <View style={styles.heroMetaRow}>
                            <View>
                                <Text style={styles.heroMetaLabel}>Order total</Text>
                                <Text style={styles.heroMetaValue}>{amount !== undefined && amount !== null ? `Rs. ${Number(amount).toFixed(2)}` : 'Available at checkout'}</Text>
                            </View>
                            <View style={styles.heroPill}>
                                <Ionicons name="lock-closed-outline" size={14} color="#FFF" />
                                <Text style={styles.heroPillText}>Encrypted</Text>
                            </View>
                        </View>
                    </LinearGradient>

                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Choose a payment option</Text>
                            <Text style={styles.sectionSubtitle}>All methods are available with a guided checkout flow.</Text>
                        </View>

                        <View style={styles.paymentGrid}>
                            {paymentOptions.map((option) => {
                                const active = selectedMethod === option.key;
                                return (
                                    <TouchableOpacity
                                        key={option.key}
                                        onPress={() => setSelectedMethod(option.key)}
                                        activeOpacity={0.9}
                                        style={[styles.paymentOption, active && styles.paymentOptionActive, { borderColor: active ? option.tone : colors.glassBorder }]}
                                    >
                                        <View style={[styles.optionIcon, { backgroundColor: `${option.tone}14` }, active && { backgroundColor: option.tone }]}>
                                            <Ionicons name={option.icon} size={18} color={active ? '#FFF' : option.tone} />
                                        </View>
                                        <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{option.label}</Text>
                                        <Text style={styles.optionDescription}>{option.description}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View>
                                <Text style={styles.sectionTitle}>{cardCopy.title}</Text>
                                <Text style={styles.sectionSubtitle}>{cardCopy.description}</Text>
                            </View>
                            <View style={[styles.methodBadge, { backgroundColor: `${methodColor}16` }]}>
                                <Ionicons name={paymentOptions.find((item) => item.key === selectedMethod)?.icon || 'card-outline'} size={14} color={methodColor} />
                                <Text style={[styles.methodBadgeText, { color: methodColor }]}>{selectedMethod.toUpperCase()}</Text>
                            </View>
                        </View>

                        {selectedMethod === 'online' ? (
                            <View>
                                <View style={styles.bankCard}>
                                    <View style={styles.bankCardHeader}>
                                        <Ionicons name="business-outline" size={22} color={colors.info} />
                                        <Text style={styles.bankCardTitle}>Transfer details</Text>
                                    </View>

                                    {bankTransferDetails.map((item) => (
                                        <View key={item.label} style={styles.bankRow}>
                                            <Text style={styles.bankLabel}>{item.label}</Text>
                                            <Text style={styles.bankValue}>{item.value}</Text>
                                        </View>
                                    ))}

                                    <View style={styles.referenceNote}>
                                        <Ionicons name="information-circle-outline" size={16} color={colors.info} />
                                        <Text style={styles.referenceNoteText}>Please include your order number when making the transfer and upload a receipt photo below.</Text>
                                    </View>
                                </View>

                                <View style={styles.receiptSection}>
                                    <Text style={styles.sectionTitle}>Upload receipt *</Text>
                                    <TouchableOpacity style={styles.receiptPicker} onPress={pickReceipt} activeOpacity={0.9}>
                                        {receiptAsset?.uri ? (
                                            <Image source={{ uri: receiptAsset.uri }} style={styles.receiptPreview} resizeMode="cover" />
                                        ) : (
                                            <View style={styles.receiptPickerEmpty}>
                                                <Ionicons name="cloud-upload-outline" size={34} color={colors.textMuted} />
                                                <Text style={styles.receiptPickerText}>Tap to upload receipt photo</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : selectedMethod === 'card' ? (
                            <>
                                <LinearGradient colors={colors.gradientDark} style={styles.cardPreview}>
                                    <View style={styles.cardPreviewTop}>
                                        <View>
                                            <Text style={styles.previewLabel}>Card Preview</Text>
                                            <Text style={styles.previewName}>{form.cardholderName || 'Cardholder Name'}</Text>
                                        </View>
                                        <View style={styles.brandChip}>
                                            <Text style={styles.brandChipText}>{cardBrand || 'Brand'}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.previewNumber}>{form.cardNumber || '1234 5678 9012 3456'}</Text>
                                    <View style={styles.cardPreviewBottom}>
                                        <View>
                                            <Text style={styles.previewMetaLabel}>Expiry</Text>
                                            <Text style={styles.previewMetaValue}>{form.expiryDate || 'MM/YY'}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.previewMetaLabel}>CVV</Text>
                                            <Text style={styles.previewMetaValue}>{form.cvv ? '***' : '***'}</Text>
                                        </View>
                                    </View>
                                </LinearGradient>

                                {renderInput('cardholderName', 'Cardholder Name', 'Name as shown on card', 'default', { autoCapitalize: 'words' })}
                                {renderInput('cardNumber', 'Card Number', '1234 5678 9012 3456', 'number-pad', { maxLength: 19 })}

                                <View style={styles.rowInputs}>
                                    {renderInput('expiryDate', 'Expiry Date', 'MM/YY', 'number-pad', { maxLength: 5 })}
                                    {renderInput('cvv', 'CVV', '123', 'number-pad', { maxLength: 3 })}
                                </View>

                                {renderInput('billingAddress', 'Billing Address', 'Street, city, postcode', 'default', { multiline: true, numberOfLines: 3 })}

                                <View style={styles.brandRow}>
                                    <Text style={styles.brandRowLabel}>Detected brand</Text>
                                    <View style={[styles.brandChip, !cardBrand && styles.brandChipMuted]}>
                                        <Text style={styles.brandChipText}>{cardBrand || 'Waiting for card number'}</Text>
                                    </View>
                                </View>
                            </>
                        ) : (
                            <View style={styles.altMethodCard}>
                                <Ionicons name={paymentOptions.find((item) => item.key === selectedMethod)?.icon || 'checkmark-circle-outline'} size={32} color={methodColor} />
                                <Text style={styles.altMethodTitle}>{cardCopy.title}</Text>
                                <Text style={styles.altMethodText}>{cardCopy.detail}</Text>
                                <View style={styles.altMethodSteps}>
                                    <View style={styles.altStepRow}>
                                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                                        <Text style={styles.altStepText}>Fast confirmation</Text>
                                    </View>
                                    <View style={styles.altStepRow}>
                                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                                        <Text style={styles.altStepText}>Secure order handoff</Text>
                                    </View>
                                    <View style={styles.altStepRow}>
                                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                                        <Text style={styles.altStepText}>Delivery-ready receipt</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeaderRow}>
                            <View>
                                <Text style={styles.sectionTitle}>Secure payment guarantees</Text>
                                <Text style={styles.sectionSubtitle}>Built for trust, clarity, and a premium mobile checkout experience.</Text>
                            </View>
                        </View>

                        <View style={styles.trustGrid}>
                            {trustBadges.map((badge) => (
                                <View key={badge.label} style={styles.trustBadge}>
                                    <Ionicons name={badge.icon} size={18} color={colors.primary} />
                                    <Text style={styles.trustBadgeText}>{badge.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <TouchableOpacity style={[styles.payButton, loading && styles.payButtonDisabled]} onPress={handlePayNow} disabled={loading} activeOpacity={0.9}>
                        <LinearGradient colors={loading ? ['#9CA3AF', '#6B7280'] : colors.gradientPrimary} style={styles.payButtonGradient}>
                            {loading ? <ActivityIndicator color="#FFF" /> : <Ionicons name={selectedMethod === 'online' ? 'cloud-upload-outline' : 'card'} size={20} color="#FFF" />}
                            <Text style={styles.payButtonText}>{loading ? 'Processing Payment...' : selectedMethod === 'online' ? 'Upload Receipt' : `Pay Now with ${paymentOptions.find((item) => item.key === selectedMethod)?.label}`}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>

                <Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => setSuccessVisible(false)}>
                    <View style={styles.modalBackdrop}>
                        <View style={styles.successModal}>
                            <View style={styles.successIconWrap}>
                                <Ionicons name="checkmark-circle" size={44} color={colors.success} />
                            </View>
                            <Text style={styles.successTitle}>{successTitle}</Text>
                            <Text style={styles.successMessage}>{successMessage}</Text>
                            <View style={styles.successDetailCard}>
                                <Text style={styles.successDetailLabel}>Reference</Text>
                                <Text style={styles.successDetailValue}>{successReference}</Text>
                            </View>
                            <TouchableOpacity style={styles.successButton} onPress={handleSuccessContinue} activeOpacity={0.9}>
                                <Text style={styles.successButtonText}>Continue to Orders</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 32 },
    heroCard: {
        borderRadius: 28,
        padding: 20,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
        elevation: 12,
        marginBottom: 14,
    },
    heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
    heroEyebrow: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
    heroTitle: { color: '#FFF', fontSize: 28, fontWeight: '800', letterSpacing: 0.2 },
    heroSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 21, marginTop: 6, maxWidth: 280 },
    heroIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroMetaRow: {
        marginTop: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    heroMetaLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
    heroMetaValue: { color: '#FFF', fontSize: 18, fontWeight: '800', marginTop: 4 },
    heroPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.14)',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    heroPillText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    sectionCard: {
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 24,
        padding: 16,
        marginBottom: 14,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    sectionHeader: { marginBottom: 14 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    sectionSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 5, lineHeight: 19 },
    paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    paymentOption: {
        width: '48%',
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: '#FBFBFD',
        padding: 14,
        marginBottom: 12,
    },
    paymentOptionActive: {
        backgroundColor: '#FFF',
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    optionIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    optionLabel: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
    optionLabelActive: { color: colors.primary },
    optionDescription: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 5 },
    methodBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
    },
    methodBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
    cardPreview: {
        borderRadius: 22,
        padding: 18,
        marginBottom: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
        elevation: 6,
    },
    cardPreviewTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    previewLabel: { color: 'rgba(255,255,255,0.76)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    previewName: { color: '#FFF', fontSize: 18, fontWeight: '800', marginTop: 8 },
    previewNumber: { color: '#FFF', fontSize: 20, fontWeight: '700', letterSpacing: 2, marginTop: 32 },
    cardPreviewBottom: { marginTop: 22, flexDirection: 'row', justifyContent: 'space-between' },
    previewMetaLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
    previewMetaValue: { color: '#FFF', fontSize: 15, fontWeight: '700', marginTop: 4 },
    brandChip: {
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.14)',
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    brandChipMuted: { backgroundColor: 'rgba(15,23,42,0.08)' },
    brandChipText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
    bankCard: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 18,
        padding: 14,
    },
    bankCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    bankCardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    bankRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 9,
        borderTopWidth: 1,
        borderTopColor: colors.glassBorder,
    },
    bankLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
    bankValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
    referenceNote: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: 'rgba(14,165,233,0.08)',
        borderRadius: 14,
        padding: 12,
    },
    referenceNoteText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.textSecondary, fontWeight: '600' },
    receiptSection: { marginTop: 14 },
    receiptPicker: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: '#FFF',
        minHeight: 190,
    },
    receiptPickerEmpty: {
        minHeight: 190,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    receiptPickerText: { marginTop: 10, fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
    receiptPreview: { width: '100%', height: 190, backgroundColor: '#FFF' },
    fieldGroup: { marginBottom: 14 },
    label: { fontSize: 13, color: colors.textSecondary, fontWeight: '700', marginBottom: 8 },
    inputShell: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 18,
        paddingRight: 44,
        overflow: 'hidden',
    },
    inputShellError: { borderColor: 'rgba(220,38,38,0.35)' },
    input: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: colors.textPrimary,
    },
    multilineInput: {
        minHeight: 104,
        textAlignVertical: 'top',
        paddingTop: 14,
    },
    inputStatusIcon: {
        position: 'absolute',
        right: 14,
        top: 14,
    },
    rowInputs: { flexDirection: 'row', gap: 10 },
    errorText: { fontSize: 12, color: colors.danger, marginTop: 6, fontWeight: '600' },
    successText: { fontSize: 12, color: colors.success, marginTop: 6, fontWeight: '600' },
    brandRow: {
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    brandRowLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
    altMethodCard: {
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    altMethodTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 10 },
    altMethodText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    altMethodSteps: { width: '100%', marginTop: 16 },
    altStepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    altStepText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    trustGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    trustBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 16,
        backgroundColor: colors.backgroundElevated,
    },
    trustBadgeText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    payButton: { borderRadius: 18, overflow: 'hidden', marginBottom: 8 },
    payButtonDisabled: { opacity: 0.8 },
    payButtonGradient: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 18,
    },
    payButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    successModal: {
        width: '100%',
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 22,
        alignItems: 'center',
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
        elevation: 10,
    },
    successIconWrap: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(22,163,74,0.08)',
        marginBottom: 14,
    },
    successTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
    successMessage: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    successDetailCard: {
        width: '100%',
        marginTop: 18,
        borderRadius: 18,
        backgroundColor: colors.backgroundElevated,
        padding: 14,
        alignItems: 'center',
    },
    successDetailLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9 },
    successDetailValue: { fontSize: 18, color: colors.primary, fontWeight: '900', marginTop: 6 },
    successButton: {
        marginTop: 18,
        width: '100%',
        borderRadius: 16,
        backgroundColor: colors.primary,
        paddingVertical: 14,
        alignItems: 'center',
    },
    successButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});