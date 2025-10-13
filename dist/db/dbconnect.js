"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.conn = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
// dotenv.config(); // โหลดตัวแปรจากไฟล์ .env
exports.conn = promise_1.default.createPool({
    connectionLimit: 10,
    host: "202.28.34.210",
    user: "66011212136",
    password: "66011212136",
    database: "db66011212136",
    port: 3309
});
