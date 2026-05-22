const jwt = require('jsonwebtoken');
const db = require('../database/db');

/**
 * Authentication middleware — verifies JWT token from Authorization header.
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await db('users')
            .join('roles', 'users.role_id', 'roles.id')
            .select(
                'users.id',
                'users.first_name',
                'users.last_name',
                'users.email',
                'users.role_id',
                'users.organization_id',
                'users.is_active',
                'roles.name as role_name',
                'roles.side as role_side',
                'roles.hierarchy_level'
            )
            .where('users.id', decoded.id)
            .first();

        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'Invalid or inactive user.' });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        return res.status(401).json({ error: 'Invalid token.' });
    }
};

/**
 * Authorization middleware — checks if user's role has permission for the module/action.
 */
const authorize = (module, action = 'can_view') => {
    return async (req, res, next) => {
        try {
            const permission = await db('permissions')
                .where({ role_id: req.user.role_id, module })
                .first();

            if (!permission || !permission[action]) {
                return res.status(403).json({ error: 'You do not have permission to perform this action.' });
            }

            next();
        } catch (err) {
            return res.status(500).json({ error: 'Authorization check failed.' });
        }
    };
};

module.exports = { authenticate, authorize };
