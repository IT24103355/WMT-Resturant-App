const express = require('express');
const router = express.Router();
const { getFoods, getFood, createFood, updateFood, deleteFood } = require('../controllers/foodController');
const { protect } = require('../middleware/auth');
const { admin } = require('../middleware/adminMiddleware');
const upload = require('../middleware/upload');

router.get('/', getFoods);
router.get('/:id', getFood);
router.post('/', protect, admin, upload.single('image'), createFood);
router.put('/:id', protect, admin, upload.single('image'), updateFood);
router.delete('/:id', protect, admin, deleteFood);

module.exports = router;
