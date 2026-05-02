const rider = (req, res, next) => {
    if (req.user && req.user.role === 'rider') {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: 'Access denied. Rider privileges required.',
    });
};

module.exports = { rider };
