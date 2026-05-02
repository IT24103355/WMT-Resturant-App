const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('../models/Order');

dotenv.config();

const deleteAllOrders = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const beforeCount = await Order.countDocuments();
        const result = await Order.deleteMany({});

        console.log('🧹 Orders deleted successfully');
        console.log(`Before: ${beforeCount}`);
        console.log(`Deleted: ${result.deletedCount}`);
        console.log(`After: ${await Order.countDocuments()}`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error deleting orders:', error.message);
        process.exit(1);
    }
};

deleteAllOrders();