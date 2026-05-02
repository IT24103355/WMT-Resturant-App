const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const OLD_EMAIL = 'admin@lagoonbites.com';
const NEW_EMAIL = 'admin@dinewave.com';

const updateAdminEmail = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const existingNewAdmin = await User.findOne({ email: NEW_EMAIL, role: 'admin' });
        if (existingNewAdmin) {
            console.log('ℹ️ Admin email already updated');
            console.log(`Email: ${existingNewAdmin.email}`);
            await mongoose.connection.close();
            process.exit(0);
        }

        const oldAdmin = await User.findOne({ email: OLD_EMAIL, role: 'admin' });
        if (!oldAdmin) {
            console.log('⚠️ No admin found with the old email');
            await mongoose.connection.close();
            process.exit(0);
        }

        oldAdmin.email = NEW_EMAIL;
        await oldAdmin.save();

        console.log('✅ Admin email updated successfully!');
        console.log(`Old Email: ${OLD_EMAIL}`);
        console.log(`New Email: ${oldAdmin.email}`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating admin email:', error.message);
        process.exit(1);
    }
};

updateAdminEmail();