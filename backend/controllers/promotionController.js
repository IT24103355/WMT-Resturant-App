const Promotion = require('../models/Promotion');

// @desc    Get all active promotions
// @route   GET /api/promotions
// @access  Public
const getPromotions = async (req, res) => {
    try {
        const now = new Date();
        const promotions = await Promotion.find({
            isActive: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now },
        })
            .populate('applicableFoods', 'name image price')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: promotions.length, data: promotions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all promotions (admin - includes inactive)
// @route   GET /api/promotions/all
// @access  Admin
const getAllPromotions = async (req, res) => {
    try {
        const promotions = await Promotion.find()
            .populate('applicableFoods', 'name image price')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: promotions.length, data: promotions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create promotion
// @route   POST /api/promotions
// @access  Admin
const createPromotion = async (req, res) => {
    try {
        const { title, description, discountPercentage, code, validFrom, validUntil, applicableFoods } = req.body;

        let image = '';
        if (req.file) {
            image = `/uploads/${req.file.filename}`;
        }

        const promotion = await Promotion.create({
            title,
            description,
            image,
            discountPercentage,
            code: code || `LAGOON${Date.now()}`,
            validFrom,
            validUntil,
            applicableFoods: applicableFoods || [],
        });

        res.status(201).json({ success: true, message: 'Promotion created', data: promotion });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Promotion code already exists' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update promotion
// @route   PUT /api/promotions/:id
// @access  Admin
const updatePromotion = async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (req.file) {
            updateData.image = `/uploads/${req.file.filename}`;
        }

        const promotion = await Promotion.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        }).populate('applicableFoods', 'name image price');

        if (!promotion) {
            return res.status(404).json({ success: false, message: 'Promotion not found' });
        }

        res.json({ success: true, message: 'Promotion updated', data: promotion });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete promotion
// @route   DELETE /api/promotions/:id
// @access  Admin
const deletePromotion = async (req, res) => {
    try {
        const promotion = await Promotion.findByIdAndDelete(req.params.id);
        if (!promotion) {
            return res.status(404).json({ success: false, message: 'Promotion not found' });
        }
        res.json({ success: true, message: 'Promotion deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getPromotions, getAllPromotions, createPromotion, updatePromotion, deletePromotion };
