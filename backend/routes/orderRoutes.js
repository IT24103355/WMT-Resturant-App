const express = require('express');
const router = express.Router();
const {
	createOrder,
	getMyOrders,
	getAllOrders,
	getOrder,
	updateOrderStatus,
	updateMyOrder,
	deleteMyOrder,
	assignRider,
	getRiderTasks,
	riderRespondTask,
	updateRiderStatus,
	updateRiderLocation,
	getRiderSummary,
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const { admin } = require('../middleware/adminMiddleware');
const { rider } = require('../middleware/riderMiddleware');
const upload = require('../middleware/upload');
const { imageOnlyUpload } = require('../middleware/upload');

router.post('/', protect, upload.array('specialRequestImages', 5), createOrder);
router.get('/', protect, getMyOrders);
router.get('/all', protect, admin, getAllOrders);
router.get('/rider/tasks', protect, rider, getRiderTasks);
router.get('/rider/summary', protect, rider, getRiderSummary);
router.put('/:id/assign-rider', protect, admin, assignRider);
router.put('/:id/rider-response', protect, rider, riderRespondTask);
router.put('/:id/rider-status', protect, rider, imageOnlyUpload.single('packageImage'), updateRiderStatus);
router.put('/:id/rider-location', protect, rider, updateRiderLocation);
router.get('/:id', protect, getOrder);
router.put('/:id', protect, upload.array('specialRequestImages', 5), updateMyOrder);
router.delete('/:id', protect, deleteMyOrder);
router.put('/:id/status', protect, admin, updateOrderStatus);

module.exports = router;
