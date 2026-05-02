import { StyleSheet, Dimensions } from 'react-native';
import colors from './colors';

const { width, height } = Dimensions.get('window');

export default StyleSheet.create({
    // Containers
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    scrollContent: {
        paddingBottom: 100,
    },

    // Glassmorphic Card
    glassCard: {
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 20,
        padding: 16,
        marginVertical: 8,
        marginHorizontal: 16,
    },
    glassCardElevated: {
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 24,
        padding: 20,
        marginVertical: 10,
        marginHorizontal: 16,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
    },

    // Typography
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.textPrimary,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    heading: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    body: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    caption: {
        fontSize: 12,
        color: colors.textMuted,
    },
    price: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.primary,
    },

    // Buttons
    primaryButton: {
        backgroundColor: colors.primary,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    outlineButton: {
        borderWidth: 1.5,
        borderColor: colors.primary,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 28,
        alignItems: 'center',
    },
    outlineButtonText: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: '600',
    },

    // Input
    input: {
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingVertical: 14,
        fontSize: 16,
        color: colors.textPrimary,
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 8,
    },

    // Row/Flex
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    // Badges
    badge: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },

    // Section
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 24,
        marginBottom: 16,
    },

    // Misc
    divider: {
        height: 1,
        backgroundColor: colors.glassBorder,
        marginVertical: 16,
    },
    screenWidth: width,
    screenHeight: height,
});
