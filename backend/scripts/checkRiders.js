const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

const checkRiders = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const riders = await User.find({ role: 'rider' });
        console.log(`\n✅ Found ${riders.length} riders in database:\n`);
        
        riders.forEach((rider) => {
            console.log(`👤 ${rider.name}`);
            console.log(`   Email: ${rider.email}`);
            console.log(`   Active: ${rider.isActive}`);
            console.log(`   Location: (${rider.riderLocation?.latitude}, ${rider.riderLocation?.longitude})`);
            console.log('');
        });

        // Test password for one rider
        if (riders.length > 0) {
            console.log('🔑 Testing password match for first rider...');
            const testPassword = 'rider123';
            const isMatch = await riders[0].matchPassword(testPassword);
            console.log(`Password match result: ${isMatch}`);
            console.log(`Password to try: ${testPassword}`);
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

checkRiders();
