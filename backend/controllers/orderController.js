const Order = require('../models/Order');
const User = require('../models/User');

const ORDER_UPDATE_WINDOW_MS = 5 * 60 * 1000;
const ACTIVE_DELIVERY_STATUSES = ['accepted', 'ready', 'picked_up', 'out_for_delivery'];
const DEFAULT_CITY_SPEED_KMPH = 25;

const generateInvoiceNumber = (orderId) => {
    const suffix = orderId.toString().slice(-6).toUpperCase();
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `INV-${stamp}-${suffix}`;
};

const buildReceiptText = (order, customer = {}) => {
    const lines = [];
    lines.push('Dine Wave Receipt');
    lines.push(`Receipt No: ${order.invoiceNumber || generateInvoiceNumber(order._id)}`);
    lines.push(`Order: ${order._id}`);
    lines.push(`Customer: ${customer.name || 'Customer'}`);
    lines.push(`Email: ${customer.email || ''}`);
    lines.push(`Date: ${new Date(order.updatedAt || order.createdAt).toLocaleString()}`);
    lines.push(`Payment Method: ${order.paymentMethod}`);
    lines.push(`Payment Status: ${order.paymentStatus}`);
    lines.push('');

    (order.items || []).forEach((item) => {
        lines.push(`${item.quantity} x ${item.name || 'Food'} - Rs. ${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}`);
    });

    lines.push('');
    lines.push(`Delivery Address: ${order.deliveryAddress || ''}`);
    if (order.specialInstructions) {
        lines.push(`Special Instructions: ${order.specialInstructions}`);
    }
    lines.push(`Total: Rs. ${Number(order.totalAmount || 0).toFixed(2)}`);

    if (order.paymentMethod === 'online') {
        lines.push('');
        lines.push('Online Transfer');
        lines.push('Transfer using your bank app and keep this receipt for confirmation.');
        lines.push(`Transfer Reference: ${order.paymentReference || 'Pending'}`);
    }

    return lines.join('\n');
};

const getOrderWindowState = (order) => {
    const createdAtMs = new Date(order.createdAt).getTime();
    const expiresAtMs = createdAtMs + ORDER_UPDATE_WINDOW_MS;
    const remainingMs = Math.max(0, expiresAtMs - Date.now());
    return {
        canEditByTime: remainingMs > 0,
        remainingSeconds: Math.ceil(remainingMs / 1000),
    };
};

const validateOrderUpdateAccess = (order, userId) => {
    if (order.user.toString() !== userId.toString()) {
        return { allowed: false, statusCode: 403, message: 'Not authorized to modify this order' };
    }

    if (order.status !== 'pending') {
        return {
            allowed: false,
            statusCode: 400,
            message: 'Order can be modified only while pending',
        };
    }

    const { canEditByTime, remainingSeconds } = getOrderWindowState(order);
    if (!canEditByTime) {
        return {
            allowed: false,
            statusCode: 400,
            message: 'Order can only be modified or deleted within 5 minutes of placing it',
            remainingSeconds,
        };
    }

    return { allowed: true, statusCode: 200, remainingSeconds };
};

const toRadians = (deg) => (deg * Math.PI) / 180;

const haversineDistanceKm = (from, to) => {
    if (!from || !to) return Number.MAX_SAFE_INTEGER;
    const lat1 = Number(from.latitude);
    const lon1 = Number(from.longitude);
    const lat2 = Number(to.latitude);
    const lon2 = Number(to.longitude);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.MAX_SAFE_INTEGER;

    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
};

const estimateEtaMinutes = (origin, destination) => {
    const distanceKm = haversineDistanceKm(origin, destination);
    if (!Number.isFinite(distanceKm) || distanceKm === Number.MAX_SAFE_INTEGER) {
        return null;
    }

    const eta = Math.ceil((distanceKm / DEFAULT_CITY_SPEED_KMPH) * 60);
    return Math.max(3, eta);
};

const buildNavigationRouteUrl = (origin, destination) => {
    const hasDestination = Number.isFinite(Number(destination?.latitude)) && Number.isFinite(Number(destination?.longitude));
    if (!hasDestination) return '';

    const params = new URLSearchParams({
        api: '1',
        travelmode: 'driving',
        destination: `${Number(destination.latitude)},${Number(destination.longitude)}`,
    });

    if (Number.isFinite(Number(origin?.latitude)) && Number.isFinite(Number(origin?.longitude))) {
        params.set('origin', `${Number(origin.latitude)},${Number(origin.longitude)}`);
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const mapUploadedFiles = (files = []) => files.map((file) => `/uploads/${file.filename}`);

const mapUploadedFile = (file) => (file ? `/uploads/${file.filename}` : '');

const buildPublicFileUrl = (req, filePath = '') => {
    if (!filePath) return '';
    if (String(filePath).startsWith('http://') || String(filePath).startsWith('https://')) {
        return filePath;
    }
    const normalized = String(filePath).startsWith('/') ? filePath : `/${filePath}`;
    return `${req.protocol}://${req.get('host')}${normalized}`;
};

const enrichOrderForClient = (req, order) => {
    if (!order) return order;
    const plain = typeof order.toObject === 'function' ? order.toObject() : { ...order };
    plain.packageImageUrl = buildPublicFileUrl(req, plain.packageImage);
    return plain;
};

const parseMaybeJson = (value) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        return JSON.parse(value);
    } catch (_) {
        return null;
    }
};

const selectNearestAvailableRider = async (order, options = {}) => {
    const excludedIds = new Set((options.excludeRiderIds || []).map((id) => id?.toString()).filter(Boolean));
    const riders = await User.find({ role: 'rider', isActive: true }).select('name phone riderLocation');

    if (!riders.length) {
        return null;
    }

    const activeLoads = await Order.aggregate([
        {
            $match: {
                assignedRider: { $ne: null },
                status: { $in: ACTIVE_DELIVERY_STATUSES },
                riderAssignmentStatus: { $in: ['assigned', 'accepted'] },
            },
        },
        {
            $group: {
                _id: '$assignedRider',
                count: { $sum: 1 },
            },
        },
    ]);
    const loadByRiderId = new Map(activeLoads.map((entry) => [entry._id.toString(), entry.count]));

    const scoredRiders = riders
        .filter((rider) => !excludedIds.has(rider._id.toString()))
        .map((rider) => ({
            rider,
            distance: haversineDistanceKm(order.deliveryLocation, rider.riderLocation),
            activeLoad: loadByRiderId.get(rider._id.toString()) || 0,
        }));

    if (!scoredRiders.length) {
        return null;
    }

    const availableRiders = scoredRiders.filter((entry) => entry.activeLoad === 0);
    const candidatePool = availableRiders.length ? availableRiders : scoredRiders;

    return candidatePool
        .sort((left, right) => {
            if (left.distance !== right.distance) return left.distance - right.distance;
            return left.activeLoad - right.activeLoad;
        })[0]?.rider || null;
};

const buildDeliveryAssignmentPayload = (order, rider, assignmentSource) => {
    const items = (order.items || []).map((item) => ({
        name: item.name || 'Food',
        quantity: item.quantity,
        price: Number(item.price || 0),
        amount: Number(item.price || 0) * Number(item.quantity || 0),
    }));

    return {
        assignmentSource,
        orderId: order._id,
        customerName: order.user?.name || '',
        customerPhone: order.user?.phone || '',
        customerAddress: order.deliveryAddress || order.user?.address || '',
        routeUrl: buildNavigationRouteUrl(rider?.riderLocation, order.deliveryLocation),
        order: {
            _id: order._id,
            totalAmount: order.totalAmount,
            status: order.status,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            deliveryAddress: order.deliveryAddress,
            deliveryLocation: order.deliveryLocation,
            items,
            assignedRider: rider
                ? {
                    _id: rider._id,
                    name: rider.name,
                    phone: rider.phone,
                    riderLocation: rider.riderLocation || null,
                }
                : null,
            user: order.user,
        },
    };
};

const emitAssignmentNotifications = (req, populatedOrder, rider, assignmentSource) => {
    const io = req.app.get('io');
    const payload = buildDeliveryAssignmentPayload(populatedOrder, rider, assignmentSource);

    io.to(rider._id.toString()).emit('deliveryAssignment', {
        message: 'New delivery task assigned',
        ...payload,
    });

    io.to('admin').emit('deliveryAssignmentUpdate', {
        orderId: populatedOrder._id,
        riderId: rider._id,
        riderName: rider.name,
        riderAssignmentStatus: populatedOrder.riderAssignmentStatus,
        status: populatedOrder.status,
        routeUrl: payload.routeUrl,
        customerName: payload.customerName,
        customerAddress: payload.customerAddress,
    });

    io.to(populatedOrder.user._id.toString()).emit('orderStatusUpdate', {
        _id: populatedOrder._id,
        orderId: populatedOrder._id,
        status: populatedOrder.status,
        riderAssignmentStatus: populatedOrder.riderAssignmentStatus,
        assignedRider: populatedOrder.assignedRider,
        riderLiveLocation: populatedOrder.riderLiveLocation,
        riderEtaMinutes: populatedOrder.riderEtaMinutes,
        routeUrl: payload.routeUrl,
        customerName: payload.customerName,
        customerAddress: payload.customerAddress,
        message: `Rider ${rider.name} assigned to your order`,
    });
};

const assignRiderToOrder = async (req, order, selectedRider, assignmentSource) => {
    order.assignedRider = selectedRider._id;
    order.riderAssignmentStatus = 'assigned';
    if (!['delivered', 'cancelled'].includes(order.status)) {
        order.status = 'accepted';
    }

    await order.save();

    const populatedOrder = await Order.findById(order._id)
        .populate('user', 'name email phone address')
        .populate('assignedRider', 'name phone riderLocation');

    emitAssignmentNotifications(req, populatedOrder, selectedRider, assignmentSource);

    return populatedOrder;
};

// @desc    Create an order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
    try {
        const {
            items,
            totalAmount,
            paymentMethod,
            deliveryAddress,
            deliveryLocation,
            specialInstructions,
        } = req.body;

        const parsedItems = Array.isArray(items) ? items : parseMaybeJson(items) || [];
        const parsedDeliveryLocation = typeof deliveryLocation === 'object'
            ? deliveryLocation
            : parseMaybeJson(deliveryLocation) || {};
        const numericTotalAmount = Number(totalAmount);

        if (!parsedItems || parsedItems.length === 0) {
            return res.status(400).json({ success: false, message: 'No order items' });
        }

        const order = await Order.create({
            user: req.user._id,
            items: parsedItems,
            totalAmount: Number.isFinite(numericTotalAmount) ? numericTotalAmount : 0,
            paymentMethod: paymentMethod || 'cash',
            paymentStatus: paymentMethod === 'card' ? 'processing' : 'pending',
            deliveryAddress: deliveryAddress || req.user.address,
            deliveryLocation: {
                latitude: Number.isFinite(Number(parsedDeliveryLocation?.latitude)) ? Number(parsedDeliveryLocation.latitude) : null,
                longitude: Number.isFinite(Number(parsedDeliveryLocation?.longitude)) ? Number(parsedDeliveryLocation.longitude) : null,
                mapUrl: parsedDeliveryLocation?.mapUrl || '',
            },
            specialInstructions: specialInstructions || '',
            specialRequestImages: mapUploadedFiles(req.files || []),
        });

        order.invoiceNumber = order.invoiceNumber || generateInvoiceNumber(order._id);
        order.receiptText = buildReceiptText(order, req.user);
        await order.save();

        const populatedOrder = await order.populate('user', 'name email phone');

        // Emit real-time event to admin
        const io = req.app.get('io');
        io.to('admin').emit('newOrder', {
            message: `New order from ${req.user.name}`,
            order: populatedOrder,
        });

        res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            data: populatedOrder,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get logged-in user's orders
// @route   GET /api/orders
// @access  Private
const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .populate('items.food', 'name image price')
            .populate('assignedRider', 'name phone')
            .sort({ createdAt: -1 });

        const data = orders.map((order) => enrichOrderForClient(req, order));
        res.json({ success: true, count: data.length, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all orders (admin)
// @route   GET /api/orders/all
// @access  Admin
const getAllOrders = async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};
        if (status) query.status = status;

        const orders = await Order.find(query)
            .populate('user', 'name email phone')
            .populate('assignedRider', 'name phone')
            .populate('items.food', 'name image price')
            .sort({ createdAt: -1 });

        // Calculate stats
        const totalRevenue = orders
            .filter((o) => o.status === 'delivered')
            .reduce((sum, o) => sum + o.totalAmount, 0);

        const data = orders.map((order) => enrichOrderForClient(req, order));

        res.json({
            success: true,
            count: data.length,
            totalRevenue,
            data,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('assignedRider', 'name phone')
            .populate('items.food', 'name image price');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Allow owner, assigned rider, or admin
        const isOwner = order.user._id.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        const isAssignedRider = order.assignedRider && order.assignedRider._id.toString() === req.user._id.toString();
        if (!isOwner && !isAdmin && !isAssignedRider) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        res.json({ success: true, data: enrichOrderForClient(req, order) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update order status (admin)
// @route   PUT /api/orders/:id/status
// @access  Admin
const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'confirmed', 'accepted', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate('user', 'name email phone address').populate('assignedRider', 'name phone riderLocation');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (status === 'ready' && !order.assignedRider) {
            const selectedRider = await selectNearestAvailableRider(order);
            if (selectedRider) {
                const assignedOrder = await assignRiderToOrder(req, order, selectedRider, 'auto');
                return res.json({
                    success: true,
                    message: `Order status updated to ${status} and rider auto-assigned`,
                    data: assignedOrder,
                });
            }
        }

        // Emit real-time update to customer
        const io = req.app.get('io');
        io.to(order.user._id.toString()).emit('orderStatusUpdate', {
            _id: order._id,
            orderId: order._id,
            status: order.status,
            assignedRider: order.assignedRider,
            riderLiveLocation: order.riderLiveLocation,
            riderEtaMinutes: order.riderEtaMinutes,
            message: `Your order is now ${status}`,
        });

        res.json({
            success: true,
            message: `Order status updated to ${status}`,
            data: order,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update own order within 5 minutes
// @route   PUT /api/orders/:id
// @access  Private
const updateMyOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const access = validateOrderUpdateAccess(order, req.user._id);
        if (!access.allowed) {
            return res.status(access.statusCode).json({
                success: false,
                message: access.message,
                remainingSeconds: access.remainingSeconds,
            });
        }

        const { deliveryAddress, deliveryLocation, specialInstructions, paymentMethod } = req.body;
        const validPaymentMethods = ['cash', 'card', 'online'];

        if (typeof deliveryAddress === 'string') {
            order.deliveryAddress = deliveryAddress;
        }

        if (typeof specialInstructions === 'string') {
            order.specialInstructions = specialInstructions;
        }

        if (deliveryLocation && typeof deliveryLocation === 'object') {
            order.deliveryLocation = {
                latitude: Number.isFinite(Number(deliveryLocation.latitude)) ? Number(deliveryLocation.latitude) : null,
                longitude: Number.isFinite(Number(deliveryLocation.longitude)) ? Number(deliveryLocation.longitude) : null,
                mapUrl: deliveryLocation.mapUrl || '',
            };
        }

        if (typeof paymentMethod === 'string') {
            if (!validPaymentMethods.includes(paymentMethod)) {
                return res.status(400).json({ success: false, message: 'Invalid payment method' });
            }

            order.paymentMethod = paymentMethod;
            if (order.paymentStatus !== 'paid') {
                order.paymentStatus = paymentMethod === 'card' ? 'processing' : 'pending';
            }
        }

        const uploadedRequestImages = mapUploadedFiles(req.files || []);
        if (uploadedRequestImages.length > 0) {
            order.specialRequestImages = [...(order.specialRequestImages || []), ...uploadedRequestImages];
        } else {
            const parsedImages = parseMaybeJson(req.body.specialRequestImages);
            if (Array.isArray(parsedImages)) {
                order.specialRequestImages = parsedImages.filter((item) => typeof item === 'string');
            }
        }

        await order.save();

        const populatedOrder = await order.populate('items.food', 'name image price');

        res.json({
            success: true,
            message: 'Order updated successfully',
            data: populatedOrder,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete own order within 5 minutes
// @route   DELETE /api/orders/:id
// @access  Private
const deleteMyOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const access = validateOrderUpdateAccess(order, req.user._id);
        if (!access.allowed) {
            return res.status(access.statusCode).json({
                success: false,
                message: access.message,
                remainingSeconds: access.remainingSeconds,
            });
        }

        await order.deleteOne();

        res.json({
            success: true,
            message: 'Order deleted successfully',
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Assign rider to order (admin)
// @route   PUT /api/orders/:id/assign-rider
// @access  Admin
const assignRider = async (req, res) => {
    try {
        const { riderId, autoAssign } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        let selectedRider = null;

        if (autoAssign) {
            selectedRider = await selectNearestAvailableRider(order);
        } else {
            selectedRider = await User.findOne({ _id: riderId, role: 'rider', isActive: true }).select('name phone riderLocation');
        }

        if (!selectedRider) {
            return res.status(400).json({ success: false, message: 'Rider not found or unavailable' });
        }

        const populatedOrder = await assignRiderToOrder(req, order, selectedRider, autoAssign ? 'auto' : 'manual');

        return res.json({
            success: true,
            message: `Rider ${selectedRider.name} assigned`,
            data: populatedOrder,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Rider task list
// @route   GET /api/orders/rider/tasks
// @access  Rider
const getRiderTasks = async (req, res) => {
    try {
        const { scope = 'active' } = req.query;
        const baseQuery = { assignedRider: req.user._id };
        if (scope === 'completed') {
            baseQuery.status = 'delivered';
        } else if (scope === 'available') {
            baseQuery.riderAssignmentStatus = 'assigned';
            baseQuery.status = { $nin: ['delivered', 'cancelled'] };
        } else {
            baseQuery.status = { $nin: ['delivered', 'cancelled'] };
            baseQuery.riderAssignmentStatus = { $in: ['assigned', 'accepted'] };
        }

        const tasks = await Order.find(baseQuery)
            .populate('user', 'name phone address')
            .sort({ createdAt: -1 });

        return res.json({ success: true, count: tasks.length, data: tasks });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Rider accepts/rejects task
// @route   PUT /api/orders/:id/rider-response
// @access  Rider
const riderRespondTask = async (req, res) => {
    try {
        const { action } = req.body;
        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        const order = await Order.findById(req.params.id).populate('user', 'name email phone');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!order.assignedRider || order.assignedRider.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not assigned to this delivery' });
        }

        if (action === 'accept') {
            order.riderAssignmentStatus = 'accepted';
        } else {
            const rejectedRiderId = order.assignedRider?.toString();
            order.riderAssignmentStatus = 'rejected';
            order.assignedRider = null;
            order.status = 'ready';
            await order.save();

            const nextRider = await selectNearestAvailableRider(order, { excludeRiderIds: [rejectedRiderId] });
            if (nextRider) {
                const reassignedOrder = await assignRiderToOrder(req, order, nextRider, 'auto_reassign');
                return res.json({
                    success: true,
                    message: `Delivery rejected and reassigned to ${nextRider.name}`,
                    data: reassignedOrder,
                });
            }

            const io = req.app.get('io');
            io.to(order.user._id.toString()).emit('orderStatusUpdate', {
                _id: order._id,
                orderId: order._id,
                status: order.status,
                riderAssignmentStatus: order.riderAssignmentStatus,
                message: 'Rider rejected assignment. Looking for another rider.',
            });
            io.to('admin').emit('deliveryAssignmentUpdate', {
                orderId: order._id,
                riderId: req.user._id,
                riderAssignmentStatus: order.riderAssignmentStatus,
                status: order.status,
            });

            return res.json({
                success: true,
                message: 'Delivery rejected. Waiting for reassignment.',
                data: order,
            });
        }

        await order.save();

        const io = req.app.get('io');
        io.to(order.user._id.toString()).emit('orderStatusUpdate', {
            _id: order._id,
            orderId: order._id,
            status: order.status,
            riderAssignmentStatus: order.riderAssignmentStatus,
            message: action === 'accept' ? 'Rider accepted your order' : 'Rider rejected assignment, reassigning soon',
        });
        io.to('admin').emit('deliveryAssignmentUpdate', {
            orderId: order._id,
            riderId: req.user._id,
            riderAssignmentStatus: order.riderAssignmentStatus,
            status: order.status,
        });

        return res.json({
            success: true,
            message: action === 'accept' ? 'Delivery accepted' : 'Delivery rejected',
            data: order,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Rider updates stage
// @route   PUT /api/orders/:id/rider-status
// @access  Rider
const updateRiderStatus = async (req, res) => {
    try {
        const { stage } = req.body;
        const valid = ['picked_up', 'out_for_delivery', 'delivered'];
        if (!valid.includes(stage)) {
            return res.status(400).json({ success: false, message: 'Invalid rider stage' });
        }

        const order = await Order.findById(req.params.id).populate('user', 'name email phone');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!order.assignedRider || order.assignedRider.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not assigned to this delivery' });
        }

        if (req.file && !String(req.file.mimetype || '').startsWith('image/')) {
            return res.status(400).json({ success: false, message: 'Package photo must be an image' });
        }

        const packageImageRequiredStages = ['picked_up', 'out_for_delivery'];
        if (packageImageRequiredStages.includes(stage) && !order.packageImage && !req.file) {
            return res.status(400).json({ success: false, message: 'Package photo is required before dispatch' });
        }

        const uploadedPackageImage = mapUploadedFile(req.file);
        if (uploadedPackageImage) {
            order.packageImage = uploadedPackageImage;
        }

        order.status = stage;
        if (stage === 'picked_up') order.pickedUpAt = new Date();
        if (stage === 'out_for_delivery') order.onTheWayAt = new Date();
        if (stage === 'delivered') {
            order.deliveredAt = new Date();
            order.riderEtaMinutes = 0;
        }

        await order.save();

        const io = req.app.get('io');
        const customerMessage = stage === 'delivered'
            ? 'Your order has been delivered successfully'
            : `Order is now ${stage.replace(/_/g, ' ')}`;

        io.to(order.user._id.toString()).emit('orderStatusUpdate', {
            _id: order._id,
            orderId: order._id,
            status: order.status,
            riderEtaMinutes: order.riderEtaMinutes,
            riderLiveLocation: order.riderLiveLocation,
            packageImage: order.packageImage,
            packageImageUrl: buildPublicFileUrl(req, order.packageImage),
            routeUrl: buildNavigationRouteUrl(order.riderLiveLocation, order.deliveryLocation),
            message: customerMessage,
        });

        io.to('admin').emit('deliveryAssignmentUpdate', {
            orderId: order._id,
            status: order.status,
            riderAssignmentStatus: order.riderAssignmentStatus,
            riderId: req.user._id,
            riderLiveLocation: order.riderLiveLocation,
            riderEtaMinutes: order.riderEtaMinutes,
            packageImage: order.packageImage,
            packageImageUrl: buildPublicFileUrl(req, order.packageImage),
            message: stage === 'delivered'
                ? `Order #${order._id.toString().slice(-6).toUpperCase()} delivered`
                : `Order #${order._id.toString().slice(-6).toUpperCase()} is ${stage.replace(/_/g, ' ')}`,
        });

        return res.json({ success: true, message: 'Rider status updated', data: enrichOrderForClient(req, order) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Rider sends live location and ETA
// @route   PUT /api/orders/:id/rider-location
// @access  Rider
const updateRiderLocation = async (req, res) => {
    try {
        const { latitude, longitude, etaMinutes } = req.body;
        const order = await Order.findById(req.params.id).populate('user', 'name email phone');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!order.assignedRider || order.assignedRider.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not assigned to this delivery' });
        }

        if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
            return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
        }

        order.riderLiveLocation = {
            latitude: Number(latitude),
            longitude: Number(longitude),
            updatedAt: new Date(),
        };
        if (Number.isFinite(Number(etaMinutes))) {
            order.riderEtaMinutes = Number(etaMinutes);
        } else {
            order.riderEtaMinutes = estimateEtaMinutes(order.riderLiveLocation, order.deliveryLocation);
        }
        await order.save();

        await User.findByIdAndUpdate(req.user._id, {
            riderLocation: {
                latitude: Number(latitude),
                longitude: Number(longitude),
                updatedAt: new Date(),
            },
        });

        const io = req.app.get('io');
        io.to(order.user._id.toString()).emit('orderTrackingUpdate', {
            _id: order._id,
            orderId: order._id,
            riderLiveLocation: order.riderLiveLocation,
            riderEtaMinutes: order.riderEtaMinutes,
            status: order.status,
            routeUrl: buildNavigationRouteUrl(order.riderLiveLocation, order.deliveryLocation),
        });

        return res.json({ success: true, message: 'Rider location updated', data: order });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Rider performance summary
// @route   GET /api/orders/rider/summary
// @access  Rider
const getRiderSummary = async (req, res) => {
    try {
        const completed = await Order.find({ assignedRider: req.user._id, status: 'delivered' })
            .select('totalAmount deliveredAt createdAt')
            .sort({ deliveredAt: -1 });

        const completedCount = completed.length;
        const earnings = completed.reduce((sum, order) => sum + (Number(order.totalAmount) * 0.1), 0);
        const performanceScore = completedCount ? Math.min(5, (4 + Math.log10(completedCount + 1))).toFixed(1) : '0.0';

        return res.json({
            success: true,
            data: {
                completedCount,
                earnings,
                performanceScore,
                deliveries: completed,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createOrder,
    getMyOrders,
    getAllOrders,
    getOrder,
    updateOrderStatus,
    updateMyOrder,
    deleteMyOrder,
    assignRider,
    getRiderTasks,
    riderRespondTask,
    updateRiderStatus,
    updateRiderLocation,
    getRiderSummary,
};
