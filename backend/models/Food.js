const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Food name is required'],
            trim: true,
        },
        description: {
            type: String,
            required: [true, 'Food description is required'],
        },
        price: {
            type: Number,
            required: [true, 'Food price is required'],
            min: [0, 'Price cannot be negative'],
        },
        image: {
            type: String,
            default: '',
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            required: [true, 'Food category is required'],
        },
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        numReviews: {
            type: Number,
            default: 0,
        },
        isAvailable: {
            type: Boolean,
            default: true,
        },
        spiceLevel: {
            type: String,
            enum: ['mild', 'hot', 'extra-hot'],
            default: 'mild',
        },
        isVegetarian: {
            type: Boolean,
            default: false,
        },
        preparationTime: {
            type: Number,
            default: 20,
            min: 0,
        },
        ingredients: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Food', foodSchema);
