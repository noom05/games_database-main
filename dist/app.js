"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
// app.ts (เฉพาะส่วนที่เปลี่ยน)
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const body_parser_1 = __importDefault(require("body-parser"));
const jwtauth_1 = require("./auth/jwtauth");
const app = (0, express_1.default)();
exports.app = app;
// 1) Body parser ก่อนจะใช้ route / middleware อื่นๆ
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.text());
// 2) Serve views / static ก่อน jwt middleware
app.use(express_1.default.static(path_1.default.join(__dirname, "views")));
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "uploads")));
app.use("/assets", express_1.default.static(path_1.default.join(__dirname, "assets")));
// 3) CORS
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
// 4) ลง jwtAuthen และระบุ path ที่ยกเว้นให้ครอบคลุม /uploads
app.use(jwtauth_1.jwtAuthen.unless({
    path: [
        "/user/login",
        "/user/register",
        "/testtoken",
        "/games/types",
        "/uploads",
        // ยกเว้น root uploads
        { url: /^\/uploads\/.*/, methods: ["GET"] }, // ยกเว้นไฟล์ภายใน uploads
        { url: /^\/games(\/.*)?$/, methods: ["GET"] } // ยกเว้น GET /games and subpaths
    ],
}));
// 5) แยก error-handler สำหรับ UnauthorizedError
app.use((err, _req, res, next) => {
    if (err && err.name === "UnauthorizedError") {
        return res.status(err.status || 401).json({ message: err.message || "Unauthorized" });
    }
    next(err);
});
// 6) Routes (ลงหลัง middleware)
const index_1 = require("./controller/index");
const user_1 = require("./controller/user");
const games_1 = require("./controller/games");
const discount_1 = require("./controller/discount");
app.use("/", index_1.router);
app.use("/user", user_1.router);
app.use("/games", games_1.router);
app.use('/discount', discount_1.router);
