const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

const seedRiders = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const riders = [
            {
                name: 'Ravi Perera',
                email: 'ravi@dinewave.com',
                password: 'rider123',
                phone: '+94701234567',
                role: 'rider',
                isActive: true,
                riderLocation: {
                    latitude: 6.9271,
                    longitude: 80.7789,
                    address: 'Colombo 03, Sri Lanka',
                },
            },
            {
                name: 'Kumar Silva',
                email: 'kumar@dinewave.com',
                password: 'rider123',
                phone: '+94702345678',
                role: 'rider',
                isActive: true,
                riderLocation: {
                    latitude: 6.9420,
                    longitude: 80.7957,
                    address: 'Colombo 04, Sri Lanka',
                },
            },
            {
                name: 'Arun Jayasuriya',
                email: 'arun@dinewave.com',
                password: 'rider123',
                phone: '+94703456789',
                role: 'rider',
                isActive: true,
                riderLocation: {
                    latitude: 6.9497,
                    longitude: 80.7891,
                    address: 'Colombo 07, Sri Lanka',
                },
            },
            {
                name: 'Priya Sandamali',
                email: 'priya@dinewave.com',
                password: 'rider123',
                phone: '+94704567890',
                role: 'rider',
                isActive: true,
                riderLocation: {
                    latitude: 6.9218,
                    longitude: 80.8094,
                    address: 'Colombo 05, Sri Lanka',
                },
            },
            {
                name: 'Dinesh Bandara',
                email: 'dinesh@dinewave.com',
                password: 'rider123',
                phone: '+94705678901',
                role: 'rider',
                isActive: true,
                riderLocation: {
                    latitude: 6.9352,
                    longitude: 80.7832,
                    address: 'Colombo 06, Sri Lanka',
                },
            },
        ];

        // Remove existing test riders
        await User.deleteMany({ role: 'rider', email: { $in: riders.map(r => r.email) } });

        // Create riders - DO NOT hash password here, let pre-save hook handle it
        const createdRiders = [];
        for (const riderData of riders) {
            const rider = new User(riderData);
            await rider.save();
            createdRiders.push(rider);
        }

        console.log('✅ Riders created successfully!');
        createdRiders.forEach((rider) => {
            console.log(`
📦 Rider: ${rider.name}
📧 Email: ${rider.email}
🔑 Password: rider123
📍 Location: ${rider.riderLocation.address}
            `);
        });

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error seeding riders:', error.message);
        process.exit(1);
    }
};

seedRiders();
