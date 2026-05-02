const mongoose = require('mongoose');
const Review = require('../models/Review');

const syncReviewIndexes = async () => {
  try {
    const indexes = await Review.collection.indexes();
    const hasLegacyUserFood = indexes.some((idx) => idx && idx.name === 'user_1_food_1');

    if (hasLegacyUserFood) {
      await Review.collection.dropIndex('user_1_food_1');
      console.log('ℹ️ Dropped legacy reviews index: user_1_food_1');
    }

    await Review.collection.createIndex(
      { user: 1, order: 1, food: 1 },
      { unique: true, name: 'user_1_order_1_food_1' }
    );
  } catch (error) {
    // Namespace not found means the collection does not exist yet.
    if (error?.codeName === 'NamespaceNotFound' || error?.code === 26) {
      return;
    }
    console.error(`⚠️ Review index sync warning: ${error.message}`);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    await syncReviewIndexes();
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
