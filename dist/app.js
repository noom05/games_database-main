"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const index_1 = require("./controller/index");
const user_1 = require("./controller/user");
const games_1 = require("./controller/games");
const body_parser_1 = __importDefault(require("body-parser"));
const path_1 = __importDefault(require("path"));
const jwtauth_1 = require("./auth/jwtauth");
exports.app = (0, express_1.default)();
exports.app.use(express_1.default.static(path_1.default.join(__dirname, "views")));
exports.app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
exports.app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "uploads")));
exports.app.use("/assets", express_1.default.static(path_1.default.join(__dirname, "assets")));
// เราจะใช้ .unless() เพื่อบอกว่า Middleware นี้จะไม่ทำงานกับ path ที่ระบุไว้
exports.app.use(jwtauth_1.jwtAuthen.unless({
    path: [
        "/user/login", // ยกเว้นหน้า Login
        "/user/register", // ยกเว้นหน้า Register
        "/testtoken", // ยกเว้นหน้า Test Token
        "/games/types", // ยกเว้นหน้า /games/types
        { url: /^\/games(\/.*)?$/, methods: ['GET'] }
    ],
}), (err, req, res, next) => {
    if (err.name === "UnauthorizedError") {
        res.status(err.status).send({ message: err.message });
        return;
    }
    next();
});
exports.app.use("/testtoken", (req, res) => {
    const payload = { username: "siriwat" };
    const jwttoken = (0, jwtauth_1.generateToken)(payload, jwtauth_1.secret);
    res.status(200).json({ token: jwttoken });
});
exports.app.use(body_parser_1.default.json());
exports.app.use(body_parser_1.default.text()); // ถ้าจำเป็นต้องใช้ text
exports.app.use("/", index_1.router);
exports.app.use("/user", user_1.router);
exports.app.use("/games", games_1.router);
