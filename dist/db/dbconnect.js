"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.conn = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // โหลดตัวแปรจากไฟล์ .env
exports.conn = promise_1.default.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST, // อ่านจากตัวแปร
    user: process.env.DB_USER, // อ่านจากตัวแปร
    password: process.env.DB_PASSWORD, // อ่านจากตัวแปร
    database: process.env.DB_DATABASE, // อ่านจากตัวแปร
    port: Number(process.env.DB_PORT) // อ่านจากตัวแปร
});
