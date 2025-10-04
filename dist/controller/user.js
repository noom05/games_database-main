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
const fileMiddleware_1 = require("../middleware/fileMiddleware");
exports.router = express_1.default.Router();
/////-------------Users---------------//////
exports.router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [rows] = yield dbconnect_1.conn.query("SELECT * FROM users");
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Cannot read users data" });
    }
}));
exports.router.post("/", fileMiddleware_1.fileUpload.diskLoader.single("file"), // multer middleware
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.body;
        const profileFilename = req.file ? req.file.filename : null;
        const hashedPassword = yield bcrypt_1.default.hash(user.password, 10);
        const sql = "INSERT INTO `users`(`username`,`email`,`password`,`profile`) VALUES (?,?,?,?)";
        const formattedSql = mysql2_1.default.format(sql, [
            user.username,
            user.email,
            hashedPassword,
            profileFilename,
        ]);
        const [result] = yield dbconnect_1.conn.query(formattedSql);
        const info = result;
        res.status(201).json({
            affected_row: info.affectedRows,
            last_idx: info.insertId,
            profile: profileFilename,
        });
    }
    catch (err) {
        console.error("POST /user error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
exports.router.delete("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = +req.params.id;
        // 1️⃣ ดึงชื่อไฟล์จาก DB ก่อน
        const [rows] = yield dbconnect_1.conn.query("SELECT profile FROM `users` WHERE uid = ?", [id]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // 2️⃣ ลบ record จาก DB
        const [result] = yield dbconnect_1.conn.query("DELETE FROM `users` WHERE uid = ?", [id]);
        const info = result;
        // 3️⃣ ลบไฟล์จริง โดยเรียก method จาก fileMiddleware
        if (user.profile) {
            fileMiddleware_1.fileUpload.deleteFile(user.profile);
        }
        res.status(200).json({ affected_row: info.affectedRows });
    }
    catch (err) {
        console.error("DELETE /user error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
exports.router.put("/:id", fileMiddleware_1.fileUpload.diskLoader.single("file"), // ✅ รองรับ upload รูปใหม่
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = +req.params.id;
        const user = req.body;
        // 1️⃣ ดึงข้อมูลผู้ใช้เดิม
        const [rows] = yield dbconnect_1.conn.query("SELECT * FROM users WHERE uid = ?", [id]);
        const result = rows;
        if (result.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        const original = result[0];
        // 2️⃣ ถ้ามีไฟล์ใหม่ อัปเดตชื่อไฟล์ใหม่ และลบไฟล์เก่า
        let profileFilename = original.profile;
        if (req.file) {
            // ลบไฟล์เก่าถ้ามี
            if (original.profile) {
                fileMiddleware_1.fileUpload.deleteFile(original.profile);
            }
            profileFilename = req.file.filename;
        }
        // 3️⃣ ถ้ามีการเปลี่ยนรหัสผ่าน
        let hashedPassword = original.password;
        if (user.password) {
            hashedPassword = yield bcrypt_1.default.hash(user.password, 10);
        }
        // 4️⃣ รวมข้อมูลเดิม + ใหม่
        const update = Object.assign(Object.assign(Object.assign({}, original), user), { password: hashedPassword, profile: profileFilename });
        // 5️⃣ อัปเดต DB
        const sql = "UPDATE users SET username=?, email=?, password=?, profile=? WHERE uid=?";
        const formattedSql = mysql2_1.default.format(sql, [
            update.username,
            update.email,
            update.password,
            update.profile,
            id,
        ]);
        const [updateResult] = yield dbconnect_1.conn.query(formattedSql);
        const info = updateResult;
        res.status(200).json({
            affected_row: info.affectedRows,
            new_profile: update.profile,
        });
    }
    catch (err) {
        console.error("PUT /user/:id error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
