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
const admin_1 = require("./controller/admin");
const body_parser_1 = __importDefault(require("body-parser"));
const path_1 = __importDefault(require("path"));
exports.app = (0, express_1.default)();
exports.app.use(express_1.default.static(path_1.default.join(__dirname, "public")));
exports.app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
exports.app.use(body_parser_1.default.text());
exports.app.use(body_parser_1.default.json());
exports.app.use("/", index_1.router);
exports.app.use("/user", user_1.router);
exports.app.use("/admin", admin_1.router);
exports.app.use("/uploads", express_1.default.static("uploads"));
