const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { admin } = require('../middleware/adminMiddleware');
const {
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
} = require('../controllers/paymentController');
const upload = require('../middleware/upload');

router.get('/config', getPaymentConfig);
router.post('/stripe/create-checkout-session', protect, createStripeCheckoutSession);
router.get('/stripe/verify/:sessionId', protect, verifyStripeCheckoutSession);
router.get('/history', protect, getMyPaymentHistory);
router.post('/refund-request/:orderId', protect, requestRefund);
router.get('/admin/analytics', protect, admin, getAdminPaymentAnalytics);
router.get('/admin/refund-requests', protect, admin, getRefundRequests);
router.put('/admin/refund-requests/:orderId', protect, admin, resolveRefundRequest);

// Dev-only: simulate confirming a payment without calling Stripe
router.post('/simulate/confirm/:orderId', protect, simulateConfirmPayment);

// Online transfer receipt upload
router.post('/online-transfer/:orderId/receipt', protect, upload.single('receipt'), uploadOnlineTransferReceipt);

module.exports = router;