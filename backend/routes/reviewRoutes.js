const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
	createReview,
	getFoodReviews,
	getMyReviews,
	getReviewInsights,
	getAllReviews,
	replyToReview,
	hideReview,
	deleteReview,
} = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');
const { admin } = require('../middleware/adminMiddleware');

router.post('/', protect, upload.array('photos', 5), createReview);
router.get('/food/:id', getFoodReviews);
router.get('/mine', protect, getMyReviews);
router.get('/insights', getReviewInsights);
router.get('/', protect, admin, getAllReviews);
router.put('/:id/reply', protect, admin, replyToReview);
router.put('/:id/hide', protect, admin, hideReview);
router.delete('/:id', protect, admin, deleteReview);

module.exports = router;
