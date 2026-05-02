const Review = require('../models/Review');
const Food = require('../models/Food');
const Order = require('../models/Order');

const recalculateFoodRating = async (foodId) => {
    const reviews = await Review.find({ food: foodId, isVisible: true });
    const avgRating = reviews.length > 0
        ? reviews.reduce((acc, r) => acc + Number(r.overallRating || r.rating || 0), 0) / reviews.length
        : 0;

    await Food.findByIdAndUpdate(foodId, {
        rating: Number(avgRating.toFixed(1)),
        numReviews: reviews.length,
    });
};

const mapPhotos = (files = []) => files.map((file) => `/uploads/${file.filename}`);

const buildReviewAggregate = async () => {
    const reviews = await Review.find({ isVisible: true });
    if (!reviews.length) {
        return {
            averageRating: 0,
            reviewCount: 0,
            dimensionAverages: {
                foodQuality: 0,
                deliverySpeed: 0,
                packaging: 0,
                service: 0,
            },
        };
    }

    const sum = reviews.reduce((acc, review) => ({
        overallRating: acc.overallRating + Number(review.overallRating || review.rating || 0),
        foodQuality: acc.foodQuality + Number(review.foodQuality || 0),
        deliverySpeed: acc.deliverySpeed + Number(review.deliverySpeed || 0),
        packaging: acc.packaging + Number(review.packaging || 0),
        service: acc.service + Number(review.service || 0),
    }), { overallRating: 0, foodQuality: 0, deliverySpeed: 0, packaging: 0, service: 0 });

    return {
        averageRating: Number((sum.overallRating / reviews.length).toFixed(1)),
        reviewCount: reviews.length,
        dimensionAverages: {
            foodQuality: Number((sum.foodQuality / reviews.length).toFixed(1)),
            deliverySpeed: Number((sum.deliverySpeed / reviews.length).toFixed(1)),
            packaging: Number((sum.packaging / reviews.length).toFixed(1)),
            service: Number((sum.service / reviews.length).toFixed(1)),
        },
    };
};

// @desc    Create review
// @route   POST /api/reviews
// @access  Private
const createReview = async (req, res) => {
    try {
        const {
            order,
            food,
            foodQuality,
            deliverySpeed,
            packaging,
            service,
            overallRating,
            comment,
            suggestions,
        } = req.body;

        if (!order || !food) {
            return res.status(400).json({ success: false, message: 'order and food are required' });
        }

        const completedOrder = await Order.findById(order);
        if (!completedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (completedOrder.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to review this order' });
        }

        if (completedOrder.status !== 'delivered') {
            return res.status(400).json({ success: false, message: 'Reviews are available after delivery only' });
        }

        const foodInOrder = (completedOrder.items || []).some((item) => String(item.food) === String(food));
        if (!foodInOrder) {
            return res.status(400).json({ success: false, message: 'Selected food item is not part of this order' });
        }

        // Check if user already reviewed this food in this order
        const existing = await Review.findOne({ user: req.user._id, order, food });
        if (existing) {
            return res.status(400).json({ success: false, message: 'You already reviewed this item for this order' });
        }

        const review = await Review.create({
            user: req.user._id,
            order,
            food,
            rating: overallRating,
            foodQuality,
            deliverySpeed,
            packaging,
            service,
            overallRating,
            comment,
            suggestions: suggestions || '',
            photos: mapPhotos(req.files),
        });

        // Update food rating
        await recalculateFoodRating(food);

        const populatedReview = await review.populate('user', 'name image avatar');

        // Notify admin of new review
        const io = req.app.get('io');
        io.to('admin').emit('newReview', {
            message: `New review from ${req.user.name}`,
            review: populatedReview,
        });

        res.status(201).json({ success: true, message: 'Review submitted', data: populatedReview });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'You already reviewed this item for this order',
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get reviews for a food item
// @route   GET /api/reviews/food/:id
// @access  Public
const getFoodReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ food: req.params.id })
            .populate('user', 'name image avatar')
            .sort({ createdAt: -1 });

        const visibleReviews = reviews.filter((review) => review.isVisible !== false);
        const overall = visibleReviews.length
            ? visibleReviews.reduce((acc, review) => acc + Number(review.overallRating || review.rating || 0), 0) / visibleReviews.length
            : 0;
        const dimensionAverages = visibleReviews.length
            ? {
                foodQuality: visibleReviews.reduce((acc, review) => acc + Number(review.foodQuality || 0), 0) / visibleReviews.length,
                deliverySpeed: visibleReviews.reduce((acc, review) => acc + Number(review.deliverySpeed || 0), 0) / visibleReviews.length,
                packaging: visibleReviews.reduce((acc, review) => acc + Number(review.packaging || 0), 0) / visibleReviews.length,
                service: visibleReviews.reduce((acc, review) => acc + Number(review.service || 0), 0) / visibleReviews.length,
            }
            : { foodQuality: 0, deliverySpeed: 0, packaging: 0, service: 0 };

        res.json({
            success: true,
            count: visibleReviews.length,
            ratingSummary: {
                averageRating: Number(overall.toFixed(1)),
                numReviews: visibleReviews.length,
                dimensionAverages: {
                    foodQuality: Number(dimensionAverages.foodQuality.toFixed(1)),
                    deliverySpeed: Number(dimensionAverages.deliverySpeed.toFixed(1)),
                    packaging: Number(dimensionAverages.packaging.toFixed(1)),
                    service: Number(dimensionAverages.service.toFixed(1)),
                },
            },
            data: visibleReviews,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get logged-in user's reviews
// @route   GET /api/reviews/mine
// @access  Private
const getMyReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ user: req.user._id })
            .populate('food', 'name image price')
            .populate('order', 'status createdAt')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: reviews.length, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Public review insights for restaurant pages
// @route   GET /api/reviews/insights
// @access  Public
const getReviewInsights = async (req, res) => {
    try {
        const summary = await buildReviewAggregate();
        const topFoods = await Food.find({ isAvailable: true })
            .sort({ rating: -1, numReviews: -1 })
            .select('name image price rating numReviews category')
            .populate('category', 'name')
            .limit(6);

        res.json({
            success: true,
            data: {
                ...summary,
                topFoods,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all reviews (admin)
// @route   GET /api/reviews
// @access  Admin
const getAllReviews = async (req, res) => {
    try {
        const reviews = await Review.find()
            .populate('user', 'name image avatar email')
            .populate('food', 'name image')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: reviews.length, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Admin reply to review
// @route   PUT /api/reviews/:id/reply
// @access  Admin
const replyToReview = async (req, res) => {
    try {
        const { adminReply } = req.body;

        const review = await Review.findByIdAndUpdate(
            req.params.id,
            { adminReply, adminRepliedAt: Date.now() },
            { new: true }
        )
            .populate('user', 'name avatar')
            .populate('food', 'name image');

        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        // Notify customer of admin reply
        const io = req.app.get('io');
        io.to(review.user._id.toString()).emit('reviewReply', {
            message: 'Admin replied to your review',
            review,
        });

        res.json({ success: true, message: 'Reply added', data: review });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Hide abusive review
// @route   PUT /api/reviews/:id/hide
// @access  Admin
const hideReview = async (req, res) => {
    try {
        const { moderationReason = 'Hidden by admin' } = req.body;
        const review = await Review.findByIdAndUpdate(
            req.params.id,
            { isVisible: false, moderationReason },
            { new: true }
        ).populate('user', 'name avatar').populate('food', 'name image');

        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        await recalculateFoodRating(review.food._id || review.food);

        return res.json({ success: true, message: 'Review hidden', data: review });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Admin
const deleteReview = async (req, res) => {
    try {
        const review = await Review.findByIdAndDelete(req.params.id);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        // Recalculate food rating
        await recalculateFoodRating(review.food);

        res.json({ success: true, message: 'Review deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createReview,
    getFoodReviews,
    getMyReviews,
    getReviewInsights,
    getAllReviews,
    replyToReview,
    hideReview,
    deleteReview,
};
