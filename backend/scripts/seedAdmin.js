const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const seedAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check if admin already exists
        const adminExists = await User.findOne({ email: 'admin@dinewave.com' });
        if (adminExists) {
            console.log('⚠️  Admin user already exists!');
            console.log(`Email: ${adminExists.email}`);
            console.log(`Role: ${adminExists.role}`);
            await mongoose.connection.close();
            process.exit(0);
        }

        // Create admin user
        const adminUser = await User.create({
            name: 'Admin',
            email: 'admin@dinewave.com',
            password: 'admin123', // Plain password - will be hashed by schema
            phone: '+94701234567',
            address: 'Colombo, Sri Lanka',
            role: 'admin',
            isActive: true,
        });

        console.log('✅ Admin user created successfully!');
        console.log('\n📧 Admin Login Credentials:');
        console.log('==========================');
        console.log(`Email: ${adminUser.email}`);
        console.log(`Password: admin123`);
        console.log(`Role: ${adminUser.role}`);
        console.log(`Name: ${adminUser.name}`);
        console.log('==========================\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding admin:', error.message);
        process.exit(1);
    }
};

seedAdmin();
