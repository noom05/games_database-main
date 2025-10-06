"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtAuthen = exports.secret = void 0;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
const express_jwt_1 = require("express-jwt");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
exports.secret = "my-top-super-impossibel";
exports.jwtAuthen = (0, express_jwt_1.expressjwt)({
    secret: exports.secret,
    algorithms: ["HS256"],
}).unless({
    path: ["/", "/user/register", "/user/login", "/testtoken"],
});
function generateToken(payload, secretKey) {
    const token = jsonwebtoken_1.default.sign(payload, secretKey, {
        expiresIn: "30d", // expires in 30 days
        issuer: "CS-MSU"
    });
    return token;
}
function verifyToken(token, secretKey) {
    try {
        const decodedPayload = jsonwebtoken_1.default.verify(token, secretKey);
        return { valid: true, decoded: decodedPayload };
    }
    catch (error) {
        return { valid: false, error: JSON.stringify(error) };
    }
}
