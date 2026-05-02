const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        items: [
            {
                food: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Food',
                    required: true,
                },
                name: String,
                image: String,
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
                price: {
                    type: Number,
                    required: true,
                },
            },
        ],
        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'accepted', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'],
            default: 'pending',
        },
        paymentMethod: {
            type: String,
            enum: ['cash', 'card', 'online'],
            default: 'cash',
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'processing', 'paid', 'failed', 'refund_pending', 'refunded'],
            default: 'pending',
        },
        paymentReference: {
            type: String,
            default: '',
        },
        receiptFile: {
            type: String,
            default: '',
        },
        packageImage: {
            type: String,
            default: '',
        },
        invoiceNumber: {
            type: String,
            default: '',
        },
        receiptText: {
            type: String,
            default: '',
        },
        specialRequestImages: {
            type: [String],
            default: [],
        },
        refund: {
            requested: {
                type: Boolean,
                default: false,
            },
            reason: {
                type: String,
                default: '',
            },
            status: {
                type: String,
                enum: ['none', 'pending', 'approved', 'rejected', 'processed'],
                default: 'none',
            },
            requestedAt: {
                type: Date,
                default: null,
            },
            resolvedAt: {
                type: Date,
                default: null,
            },
            resolutionNote: {
                type: String,
                default: '',
            },
        },
        deliveryAddress: {
            type: String,
            default: '',
        },
        deliveryLocation: {
            latitude: {
                type: Number,
                default: null,
            },
            longitude: {
                type: Number,
                default: null,
            },
            mapUrl: {
                type: String,
                default: '',
            },
        },
        assignedRider: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        riderAssignmentStatus: {
            type: String,
            enum: ['none', 'assigned', 'accepted', 'rejected'],
            default: 'none',
        },
        riderLiveLocation: {
            latitude: {
                type: Number,
                default: null,
            },
            longitude: {
                type: Number,
                default: null,
            },
            updatedAt: {
                type: Date,
                default: null,
            },
        },
        riderEtaMinutes: {
            type: Number,
            default: null,
        },
        pickedUpAt: {
            type: Date,
            default: null,
        },
        onTheWayAt: {
            type: Date,
            default: null,
        },
        deliveredAt: {
            type: Date,
            default: null,
        },
        specialInstructions: {
            type: String,
            default: '',
        },
        estimatedDeliveryTime: {
            type: Number,
            default: 30,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
