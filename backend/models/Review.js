const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        food: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Food',
            required: true,
        },
        rating: {
            type: Number,
            required: false,
            min: 1,
            max: 5,
        },
        foodQuality: {
            type: Number,
            required: [true, 'Food quality rating is required'],
            min: 1,
            max: 5,
        },
        deliverySpeed: {
            type: Number,
            required: [true, 'Delivery speed rating is required'],
            min: 1,
            max: 5,
        },
        packaging: {
            type: Number,
            required: [true, 'Packaging rating is required'],
            min: 1,
            max: 5,
        },
        service: {
            type: Number,
            required: [true, 'Service rating is required'],
            min: 1,
            max: 5,
        },
        overallRating: {
            type: Number,
            required: [true, 'Overall rating is required'],
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            required: [true, 'Review comment is required'],
            trim: true,
        },
        suggestions: {
            type: String,
            default: '',
            trim: true,
        },
        photos: {
            type: [String],
            default: [],
        },
        adminReply: {
            type: String,
            default: '',
        },
        adminRepliedAt: {
            type: Date,
        },
        isVisible: {
            type: Boolean,
            default: true,
        },
        moderationReason: {
            type: String,
            default: '',
        },
    },
    { timestamps: true }
);

// One review per user per order per food
reviewSchema.index({ user: 1, order: 1, food: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
