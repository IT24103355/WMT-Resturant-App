const Food = require('../models/Food');

// @desc    Get all foods
// @route   GET /api/foods
// @access  Public
const getFoods = async (req, res) => {
    try {
        const { category, search, spiceLevel, isVegetarian, available, minPrice, maxPrice, sort } = req.query;
        let query = {};

        if (category) query.category = category;
        if (spiceLevel) query.spiceLevel = spiceLevel;
        if (isVegetarian) query.isVegetarian = isVegetarian === 'true';
        if (available !== undefined) query.isAvailable = available === 'true';
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        if (minPrice !== undefined || maxPrice !== undefined) {
            query.price = {};
            if (minPrice !== undefined && !isNaN(Number(minPrice))) query.price.$gte = Number(minPrice);
            if (maxPrice !== undefined && !isNaN(Number(maxPrice))) query.price.$lte = Number(maxPrice);
        }

        let mongoQuery = Food.find(query).populate('category', 'name');

        // Sorting
        if (sort === 'priceAsc') mongoQuery = mongoQuery.sort({ price: 1 });
        else if (sort === 'priceDesc') mongoQuery = mongoQuery.sort({ price: -1 });
        else if (sort === 'popular') mongoQuery = mongoQuery.sort({ rating: -1, numReviews: -1 });
        else mongoQuery = mongoQuery.sort({ createdAt: -1 });

        const foods = await mongoQuery;

        res.json({
            success: true,
            count: foods.length,
            data: foods,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single food
// @route   GET /api/foods/:id
// @access  Public
const getFood = async (req, res) => {
    try {
        const food = await Food.findById(req.params.id).populate('category', 'name');
        if (!food) {
            return res.status(404).json({ success: false, message: 'Food not found' });
        }
        res.json({ success: true, data: food });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create food
// @route   POST /api/foods
// @access  Admin
const createFood = async (req, res) => {
    try {
        const { name, description, price, category, spiceLevel, isVegetarian, preparationTime, ingredients } = req.body;

        let image = '';
        if (req.file) {
            image = `/uploads/${req.file.filename}`;
        }

        const food = await Food.create({
            name,
            description,
            price,
            image,
            category,
            spiceLevel: spiceLevel || 'mild',
            isVegetarian: isVegetarian || false,
            preparationTime: preparationTime || 20,
            ingredients: ingredients ? (typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients) : [],
        });

        const populatedFood = await food.populate('category', 'name');

        res.status(201).json({
            success: true,
            message: 'Food item created successfully',
            data: populatedFood,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update food
// @route   PUT /api/foods/:id
// @access  Admin
const updateFood = async (req, res) => {
    try {
        let food = await Food.findById(req.params.id);
        if (!food) {
            return res.status(404).json({ success: false, message: 'Food not found' });
        }

        const updateData = { ...req.body };
        if (req.file) {
            updateData.image = `/uploads/${req.file.filename}`;
        }
        if (updateData.ingredients && typeof updateData.ingredients === 'string') {
            updateData.ingredients = JSON.parse(updateData.ingredients);
        }

        food = await Food.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).populate('category', 'name');

        res.json({
            success: true,
            message: 'Food item updated successfully',
            data: food,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete food
// @route   DELETE /api/foods/:id
// @access  Admin
const deleteFood = async (req, res) => {
    try {
        const food = await Food.findById(req.params.id);
        if (!food) {
            return res.status(404).json({ success: false, message: 'Food not found' });
        }

        await Food.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Food item deleted successfully',
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getFoods, getFood, createFood, updateFood, deleteFood };
