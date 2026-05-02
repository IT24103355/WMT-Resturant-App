const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Promotion title is required'],
            trim: true,
        },
        description: {
            type: String,
            required: [true, 'Promotion description is required'],
        },
        image: {
            type: String,
            default: '',
        },
        discountPercentage: {
            type: Number,
            required: [true, 'Discount percentage is required'],
            min: 0,
            max: 100,
        },
        code: {
            type: String,
            unique: true,
            uppercase: true,
            trim: true,
        },
        validFrom: {
            type: Date,
            required: true,
        },
        validUntil: {
            type: Date,
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        applicableFoods: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Food',
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Promotion', promotionSchema);
