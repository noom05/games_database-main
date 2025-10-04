"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const dbconnect_1 = require("../db/dbconnect");
const mysql2_1 = __importDefault(require("mysql2"));
const bcrypt_1 = __importDefault(require("bcrypt"));
exports.router = express_1.default.Router();
exports.router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [rows] = yield dbconnect_1.conn.query("SELECT * FROM admin");
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Cannot read admin data" });
    }
}));
exports.router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.body;
        const hashedPassword = yield bcrypt_1.default.hash(user.password, 10);
        const sql = "INSERT INTO `admin`(`username`,`email`,`password`,`profile`) VALUES (?,?,?,?)";
        const formattedSql = mysql2_1.default.format(sql, [
            user.username,
            user.email,
            hashedPassword,
            user.profile,
        ]);
        const [result] = yield dbconnect_1.conn.query(formattedSql); // async/await
        const info = result;
        res
            .status(201)
            .json({ affected_row: info.affectedRows, last_idx: info.insertId });
    }
    catch (err) {
        console.error("POST /admin error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
exports.router.delete("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = +req.params.id;
        const [result] = yield dbconnect_1.conn.query("DELETE FROM `admin` WHERE aid = ?", [
            id,
        ]);
        const info = result;
        res.status(200).json({ affected_row: info.affectedRows });
    }
    catch (err) {
        console.error("DELETE /admin error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
exports.router.put("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = +req.params.id;
        const admin = req.body; // Partial = อนุญาต update field บางส่วน
        // ดึงข้อมูล user เดิม
        const [rows] = yield dbconnect_1.conn.query("SELECT * FROM admin WHERE aid = ?", [id]);
        const result = rows;
        if (result.length === 0) {
            return res.status(404).json({ message: "Admin not found" });
        }
        const original = result[0];
        // ถ้า request มี password ใหม่ ให้ hash
        let hashedPassword = original.password;
        if (admin.password) {
            hashedPassword = yield bcrypt_1.default.hash(admin.password, 10);
        }
        // รวมข้อมูลเดิมกับข้อมูลใหม่
        const update = Object.assign(Object.assign(Object.assign({}, original), admin), { password: hashedPassword });
        const sql = "UPDATE admin SET username=?, email=?, password=?, profile=? WHERE aid=?";
        const formattedSql = mysql2_1.default.format(sql, [
            update.username,
            update.email,
            update.password,
            update.profile,
            id,
        ]);
        const [updateResult] = yield dbconnect_1.conn.query(formattedSql);
        const info = updateResult;
        res.status(200).json({ affected_row: info.affectedRows });
    }
    catch (err) {
        console.error("PUT /admin/:id error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
