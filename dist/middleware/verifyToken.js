"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function verifyToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized: Missing token" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, "my-top-super-impossibel"); // ✅ ต้องใช้ secret เดียวกับตอน generateToken
        req.user = decoded; // ✅ เก็บ payload ลงใน req.user
        next();
    }
    catch (err) {
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
}
