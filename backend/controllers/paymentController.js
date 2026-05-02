const Stripe = require('stripe');
const Order = require('../models/Order');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const isStripeKeyConfigured =
    typeof stripeSecretKey === 'string' &&
    (stripeSecretKey.startsWith('sk_test_') || stripeSecretKey.startsWith('sk_live_'));

const stripe = isStripeKeyConfigured ? new Stripe(stripeSecretKey) : null;

const generateInvoiceNumber = (orderId) => {
    const suffix = orderId.toString().slice(-6).toUpperCase();
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `INV-${stamp}-${suffix}`;
};

const buildReceiptText = (order) => {
    const lines = [];
    lines.push(`Dine Wave Receipt`);
    lines.push(`Invoice: ${order.invoiceNumber || generateInvoiceNumber(order._id)}`);
    lines.push(`Order: ${order._id}`);
    lines.push(`Date: ${new Date(order.updatedAt || order.createdAt).toLocaleString()}`);
    lines.push(`Payment Method: ${order.paymentMethod}`);
    lines.push(`Payment Status: ${order.paymentStatus}`);
    lines.push('');
    (order.items || []).forEach((item) => {
        lines.push(`${item.quantity} x ${item.name || 'Food'} - Rs. ${(item.price * item.quantity).toFixed(2)}`);
    });
    lines.push('');
    lines.push(`Total: Rs. ${Number(order.totalAmount || 0).toFixed(2)}`);
    if (order.paymentMethod === 'online') {
        lines.push('');
        lines.push('Online Transfer');
        lines.push(`Receipt File: ${order.receiptFile || 'Not uploaded'}`);
        lines.push(`Transfer Reference: ${order.paymentReference || 'Pending'}`);
    }
    return lines.join('\n');
};

const getPaymentConfig = async (req, res) => {
    return res.json({
        success: true,
        data: {
            cardEnabled: !!stripe,
            walletEnabled: false,
            paypalEnabled: false,
            saveCardsEnabled: false,
            // Expose the payment methods supported by the app UI
            availableMethods: ['cash', 'online', ...(stripe ? ['card'] : [])],
        },
    });
};

const createStripeCheckoutSession = async (req, res) => {
    try {
        if (!stripe) {
            return res.status(400).json({
                success: false,
                message: 'Card payment is not configured. Please use Cash on Delivery or Online Transfer.',
            });
        }

        const { orderId, returnUrl } = req.body;

        if (!orderId || !returnUrl) {
            return res.status(400).json({
                success: false,
                message: 'orderId and returnUrl are required',
            });
        }

        const order = await Order.findById(orderId).populate('user', 'name email');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (order.paymentMethod !== 'card') {
            return res.status(400).json({ success: false, message: 'This order is not marked for card payment' });
        }

        const successUrl = `${returnUrl}?payment=success&orderId=${order._id}&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${returnUrl}?payment=cancel&orderId=${order._id}`;

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'lkr',
                        product_data: {
                            name: `Dine Wave Order #${order._id.toString().slice(-6).toUpperCase()}`,
                        },
                        unit_amount: Math.round(order.totalAmount),
                    },
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                orderId: order._id.toString(),
                userId: req.user._id.toString(),
            },
        });

        order.paymentStatus = 'processing';
        order.paymentReference = session.id;
        await order.save();

        return res.json({
            success: true,
            message: 'Checkout session created',
            data: {
                sessionId: session.id,
                checkoutUrl: session.url,
            },
        });
    } catch (error) {
        const isStripeConfigError =
            typeof error?.message === 'string' &&
            (error.message.includes('Invalid API Key') || error.message.includes('No API key provided'));

        return res.status(isStripeConfigError ? 400 : 500).json({
            success: false,
            message: isStripeConfigError
                ? 'Card payment is not configured. Please use Cash on Delivery or Online Transfer.'
                : error.message,
        });
    }
};

const verifyStripeCheckoutSession = async (req, res) => {
    try {
        if (!stripe) {
            return res.status(400).json({
                success: false,
                message: 'Card payment is not configured. Please use Cash on Delivery or Online Transfer.',
            });
        }

        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ success: false, message: 'sessionId is required' });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (!session) {
            return res.status(404).json({ success: false, message: 'Checkout session not found' });
        }

        const orderId = session.metadata?.orderId;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (session.payment_status === 'paid') {
            order.paymentStatus = 'paid';
            order.paymentReference = session.id;
            order.status = 'confirmed';
            order.invoiceNumber = order.invoiceNumber || generateInvoiceNumber(order._id);
            order.receiptText = buildReceiptText(order);
            await order.save();
        }

        return res.json({
            success: true,
            message: session.payment_status === 'paid' ? 'Payment confirmed' : 'Payment not completed',
            data: {
                paymentStatus: session.payment_status,
                orderId: order._id,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get customer's payment history
// @route   GET /api/payments/history
// @access  Private
const getMyPaymentHistory = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .select('totalAmount paymentMethod paymentStatus paymentReference invoiceNumber receiptText refund status createdAt updatedAt')
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            count: orders.length,
            data: orders,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Request refund for an order
// @route   POST /api/payments/refund-request/:orderId
// @access  Private
const requestRefund = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const isEligible = order.status === 'cancelled' || order.paymentStatus === 'failed';

        if (order.refund?.status === 'pending' || order.refund?.status === 'approved' || order.refund?.status === 'processed') {
            return res.status(400).json({
                success: false,
                message: 'Refund request already exists for this order',
            });
        }

        if (!isEligible) {
            return res.status(400).json({
                success: false,
                message: 'Refund can be requested only for cancelled or failed paid orders',
            });
        }

        order.refund = {
            ...(order.refund || {}),
            requested: true,
            reason: reason || 'Customer requested refund',
            status: 'pending',
            requestedAt: new Date(),
            resolutionNote: '',
            resolvedAt: null,
        };
        order.paymentStatus = 'refund_pending';
        await order.save();

        return res.json({
            success: true,
            message: 'Refund request submitted',
            data: order,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get admin payment analytics
// @route   GET /api/payments/admin/analytics
// @access  Admin
const getAdminPaymentAnalytics = async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [dailyPaid, pendingPayments, successfulTransactions, refundRequests] = await Promise.all([
            Order.aggregate([
                { $match: { paymentStatus: 'paid', updatedAt: { $gte: todayStart } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } },
            ]),
            Order.countDocuments({ paymentStatus: { $in: ['pending', 'processing', 'refund_pending'] } }),
            Order.countDocuments({ paymentStatus: 'paid' }),
            Order.countDocuments({ 'refund.status': 'pending' }),
        ]);

        return res.json({
            success: true,
            data: {
                dailyRevenue: dailyPaid?.[0]?.total || 0,
                pendingPayments,
                successfulTransactions,
                refundRequests,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get refund requests (admin)
// @route   GET /api/payments/admin/refund-requests
// @access  Admin
const getRefundRequests = async (req, res) => {
    try {
        const orders = await Order.find({ 'refund.status': 'pending' })
            .populate('user', 'name email phone')
            .sort({ 'refund.requestedAt': -1 });

        return res.json({
            success: true,
            count: orders.length,
            data: orders,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Resolve refund request (admin)
// @route   PUT /api/payments/admin/refund-requests/:orderId
// @access  Admin
const resolveRefundRequest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action, note } = req.body;

        if (!['approve', 'reject', 'process'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const statusMap = {
            approve: 'approved',
            reject: 'rejected',
            process: 'processed',
        };

        order.refund = {
            ...(order.refund || {}),
            requested: true,
            status: statusMap[action],
            resolvedAt: new Date(),
            resolutionNote: note || '',
        };

        if (action === 'process') {
            order.paymentStatus = 'refunded';
        } else if (action === 'reject') {
            order.paymentStatus = 'paid';
        } else {
            order.paymentStatus = 'refund_pending';
        }

        await order.save();

        return res.json({
            success: true,
            message: `Refund request ${statusMap[action]}`,
            data: order,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Development helper: simulate confirming a payment without Stripe
const simulateConfirmPayment = async (req, res) => {
    try {
        // Only allow simulation in non-production environments
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ success: false, message: 'Simulate endpoint disabled in production' });
        }

        const { orderId } = req.params;
        const order = await Order.findById(orderId).populate('user', 'name email');
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        if (order.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        order.paymentStatus = 'paid';
        order.paymentReference = `SIMULATED_${Date.now()}`;
        order.status = 'confirmed';
        order.invoiceNumber = order.invoiceNumber || generateInvoiceNumber(order._id);
        order.receiptText = buildReceiptText(order);
        await order.save();

        return res.json({ success: true, message: 'Payment simulated and order marked as paid', data: order });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const uploadOnlineTransferReceipt = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId).populate('user', 'name email phone');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Receipt file is required' });
        }

        order.paymentMethod = 'online';
        order.paymentStatus = 'processing';
        order.receiptFile = `/uploads/${req.file.filename}`;
        order.paymentReference = order.paymentReference || `ONLINE_${Date.now()}`;
        order.invoiceNumber = order.invoiceNumber || generateInvoiceNumber(order._id);
        order.receiptText = buildReceiptText(order, req.user);
        await order.save();

        return res.json({
            success: true,
            message: 'Receipt uploaded successfully',
            data: order,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getPaymentConfig,
    createStripeCheckoutSession,
    verifyStripeCheckoutSession,
    getMyPaymentHistory,
    requestRefund,
    getAdminPaymentAnalytics,
    getRefundRequests,
    resolveRefundRequest,
    simulateConfirmPayment,
    uploadOnlineTransferReceipt,
};