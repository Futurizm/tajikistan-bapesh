const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

module.exports = function(roles) {
    return function(req, res, next) {
        if (req.methidod === 'OPTIONS') {
            next();
        }
        try {
            const token = req.headers.authorization.split(' ')[1]; // Bearer TOKEN
            if (!token) {
                return res.status(401).json({ message: 'User not authorized' });
            }
            const { roles: userRoles } = jwt.verify(token, process.env.SECRET_KEY);
            let hasRole = false;
            userRoles.forEach(role => {
                if (roles.includes(role)) {
                    hasRole = true;
                }
            });
            if (!hasRole) {
                return res.status(403).json({ message: 'у вас нет доступа' });
            }
            next();
        } catch (error) {
            res.status(403).json({ message: 'User not authorized' });

        }
    }
}