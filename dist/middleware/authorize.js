"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRole = authorizeRole;
// Middleware ตรวจสอบสิทธิ์ตาม role
function authorizeRole(roles) {
    return (req, res, next) => {
        // user info ถูกใส่ใน req.user จาก express-jwt
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden: Access denied" });
        }
        next();
    };
}
