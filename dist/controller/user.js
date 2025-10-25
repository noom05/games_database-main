"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const dbconnect_1 = require("../db/dbconnect");
const bcrypt_1 = __importDefault(require("bcrypt"));
const fileMiddleware_1 = require("../middleware/fileMiddleware");
const jwtauth_1 = require("../auth/jwtauth");
const cloudinary_1 = __importDefault(require("../cloudinary"));
const fs_1 = __importDefault(require("fs"));
exports.router = express_1.default.Router();
// --- User Management Routes ---
// GET all users
exports.router.get("/", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.conn.query("SELECT uid, username, email, role, profile FROM users");
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Cannot read users data" });
    }
});
// --- Wallet & Transaction Routes ---
// GET Wallet Balance
exports.router.get("/wallet/:id", async (req, res) => {
    const userId = req.params.id;
    const [rows] = await dbconnect_1.conn.query("SELECT balance FROM wallet WHERE user_id = ?", [userId]);
    if (rows.length === 0) {
        return res.status(404).json({ error: "Wallet not found" });
    }
    res.json(rows[0]);
});
// POST Top-up Wallet
exports.router.post("/wallet/topup", async (req, res) => {
    const { user_id, amount } = req.body;
    const connection = await dbconnect_1.conn.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query("SELECT balance FROM wallet WHERE user_id = ? FOR UPDATE", [user_id]);
        if (rows.length === 0) {
            await connection.query("INSERT INTO wallet (user_id, balance) VALUES (?, ?)", [user_id, amount]);
        }
        else {
            await connection.query("UPDATE wallet SET balance = balance + ? WHERE user_id = ?", [amount, user_id]);
        }
        await connection.query("INSERT INTO transaction (user_id, type, amount) VALUES (?, 'topup', ?)", [user_id, amount]);
        await connection.commit();
        res.json({ message: "Top-up successful" });
    }
    catch (err) {
        await connection.rollback();
        res.status(500).json({ error: "Top-up failed", detail: err });
    }
    finally {
        connection.release();
    }
});
// POST Purchase Game (ฉบับอัปเดต รองรับส่วนลด)
// POST /user/wallet/purchase
exports.router.post("/wallet/purchase", async (req, res) => {
    // 1. รับ discount_code เพิ่มจาก body
    const { user_id, game_id, discount_code } = req.body;
    if (!user_id || !game_id) {
        return res.status(400).json({ error: "User ID and Game ID are required." });
    }
    const connection = await dbconnect_1.conn.getConnection();
    try {
        await connection.beginTransaction();
        // --- ตัวแปรสำหรับคำนวณราคา ---
        let original_price = 0;
        let final_price = 0;
        let discountCodeData = null; // เก็บข้อมูลโค้ดที่ใช้
        // 2. ดึงข้อมูลเกม (ล็อคแถว)
        const [gameRows] = await connection.query("SELECT id, game_name, price FROM games WHERE id = ? FOR UPDATE", [game_id]);
        if (gameRows.length === 0)
            throw new Error("Game not found");
        const game = gameRows[0];
        original_price = game.price;
        final_price = game.price; // ราคาเริ่มต้น = ราคาเต็ม
        // 3. ดึงข้อมูลกระเป๋าเงิน (ล็อคแถว)
        const [walletRows] = await connection.query("SELECT balance FROM wallet WHERE user_id = ? FOR UPDATE", [user_id]);
        if (walletRows.length === 0)
            throw new Error("Wallet not found");
        const wallet = walletRows[0];
        // 4. เช็คว่าเคยซื้อเกมนี้หรือยัง
        const [duplicateCheck] = await connection.query("SELECT id FROM transaction WHERE user_id = ? AND game_id = ? AND type = 'purchase'", [user_id, game_id]);
        if (duplicateCheck.length > 0) {
            throw new Error("You already purchased this game");
        }
        // 5. [LOGIC ใหม่] ตรวจสอบและคำนวณส่วนลด (ถ้ามีโค้ดส่งมา)
        if (discount_code) {
            // 5.1 ค้นหาโค้ดและล็อคแถว (สำคัญมากที่ต้อง FOR UPDATE)
            const [codeRows] = await connection.query("SELECT * FROM discount_codes WHERE code = ? AND is_active = TRUE FOR UPDATE", [discount_code.toUpperCase()]);
            if (codeRows.length === 0)
                throw new Error("โค้ดส่วนลดไม่ถูกต้อง");
            const code = codeRows[0];
            discountCodeData = code; // เก็บข้อมูลโค้ดไว้ใช้ตอนจบ
            // 5.2 เช็คเงื่อนไขโค้ด (เหมือนใน /apply)
            if (code.expiry_date && new Date(code.expiry_date) < new Date()) {
                throw new Error("โค้ดส่วนลดนี้หมดอายุแล้ว");
            }
            if (code.current_uses >= code.max_uses) {
                throw new Error("โค้ดส่วนลดนี้ถูกใช้เต็มจำนวนแล้ว");
            }
            // 5.3 เช็คว่าเคยใช้หรือยัง
            const [usageRows] = await connection.query("SELECT id FROM user_discount_usage WHERE user_id = ? AND code_id = ?", [user_id, code.id]);
            if (usageRows.length > 0) {
                throw new Error("คุณใช้โค้ดส่วนลดนี้ไปแล้ว");
            }
            // 5.4 คำนวณราคาสุดท้าย
            if (code.discount_type === 'percent') {
                final_price = original_price - (original_price * (code.discount_value / 100));
            }
            else if (code.discount_type === 'fixed') {
                final_price = original_price - code.discount_value;
            }
            // ป้องกันราคาติดลบ
            if (final_price < 0) {
                final_price = 0;
            }
        }
        // 6. [LOGIC แก้ไข] เช็คยอดเงินคงเหลือ เทียบกับ "ราคาสุดท้าย"
        if (wallet.balance < final_price) {
            throw new Error("Not enough balance");
        }
        // 7. [LOGIC แก้ไข] หักเงินออกจาก wallet ด้วย "ราคาสุดท้าย"
        await connection.query("UPDATE wallet SET balance = balance - ? WHERE user_id = ?", [final_price, user_id]);
        // 8. [LOGIC แก้ไข] บันทึก transaction ด้วย "ราคาสุดท้าย"
        await connection.query("INSERT INTO transaction (user_id, type, amount, game_id) VALUES (?, 'purchase', ?, ?)", [user_id, final_price, game_id]);
        // 9. [LOGIC ใหม่] อัปเดตตารางส่วนลด (ถ้ามีการใช้งาน)
        if (discountCodeData) {
            // 9.1 เพิ่มจำนวนการใช้
            await connection.query("UPDATE discount_codes SET current_uses = current_uses + 1 WHERE id = ?", [discountCodeData.id]);
            // 9.2 บันทึกว่า User นี้ใช้โค้ดนี้แล้ว
            await connection.query("INSERT INTO user_discount_usage (user_id, code_id) VALUES (?, ?)", [user_id, discountCodeData.id]);
        }
        // 10. ดึงยอดเงินล่าสุด
        const [updatedWallet] = await connection.query("SELECT balance FROM wallet WHERE user_id = ?", [user_id]);
        // 11. จบ Transaction
        await connection.commit();
        res.json({
            message: "Purchase successful",
            balance: updatedWallet[0].balance,
        });
    }
    catch (err) {
        // หากเกิด Error ใดๆ (เช่น เงินไม่พอ, โค้ดผิด) ให้ Rollback ทั้งหมด
        await connection.rollback();
        console.error("Purchase failed:", err.message);
        // ส่ง Error ที่เกิดขึ้นจริงกลับไปให้ Frontend
        res.status(400).json({ error: err.message });
    }
    finally {
        connection.release();
    }
});
//get game purchase by user_id and game_id
exports.router.get("/game/:gameId/detail", async (req, res) => {
    const gameId = +req.params.gameId;
    if (!req.query.userId) {
        return res.status(400).json({ error: "userId is required" });
    }
    const userId = +req.query.userId;
    try {
        // ดึงข้อมูลเกม
        const [gameRows] = await dbconnect_1.conn.query('SELECT * FROM games WHERE id = ?', [gameId]);
        if (gameRows.length === 0) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // ตรวจสอบว่าผู้ใช้ซื้อเกมนี้แล้วหรือยัง
        const [purchaseRows] = await dbconnect_1.conn.query(`SELECT * FROM transaction 
       WHERE user_id = ? AND game_id = ? AND type = 'purchase'`, [userId, gameId]);
        const isPurchased = purchaseRows.length > 0;
        // ส่งข้อมูลทั้งหมด
        res.json({
            game: gameRows[0],
            isPurchased
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// GET User's Transaction History
exports.router.get("/history/:id", async (req, res) => {
    const userId = req.params.id;
    const [rows] = await dbconnect_1.conn.query(`SELECT t.*, g.game_name 
         FROM transaction t
         LEFT JOIN games g ON t.game_id = g.id
         WHERE t.user_id = ?
         ORDER BY t.transaction_date DESC`, [userId]);
    res.json(rows);
});
// GET All Transactions (For Admin)
exports.router.get("/admin/history", async (req, res) => {
    const [rows] = await dbconnect_1.conn.query(`SELECT t.*, u.username, g.game_name 
         FROM transaction t
         LEFT JOIN users u ON t.user_id = u.uid
         LEFT JOIN games g ON t.game_id = g.id
         ORDER BY t.transaction_date DESC`);
    res.json(rows);
});
// GET user by id
exports.router.get("/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const [rows] = await dbconnect_1.conn.query("SELECT uid, username, email, role, profile FROM users WHERE uid = ?", [id]);
        const users = rows;
        if (users.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(users[0]);
    }
    catch (err) {
        console.error("GET /user/:id error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// POST (Register) a new user
exports.router.post("/register", fileMiddleware_1.fileUpload.diskLoader.single("file"), async (req, res) => {
    try {
        const user = req.body;
        const profileFilename = req.file ? req.file.filename : null;
        const hashedPassword = await bcrypt_1.default.hash(user.password, 10);
        const sql = "INSERT INTO `users`(`username`,`email`,`password`,`profile`, `role`) VALUES (?,?,?,?,'user')";
        const [result] = await dbconnect_1.conn.query(sql, [
            user.username,
            user.email,
            hashedPassword,
            profileFilename,
        ]);
        const info = result;
        res.status(201).json({
            message: "สมัครสมาชิกสำเร็จ",
            user: {
                uid: info.insertId,
                username: user.username,
                email: user.email,
                profile: profileFilename,
                role: "user",
            },
        });
    }
    catch (err) {
        console.error("POST /user/register error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// POST (Login)
exports.router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM users WHERE username = ?", [
            username,
        ]);
        if (rows.length === 0)
            return res.status(401).json({ error: "ไม่พบชื่อผู้ใช้ในระบบ" });
        const user = rows[0];
        const isMatch = await bcrypt_1.default.compare(password, user.password);
        if (!isMatch)
            return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
        const payload = { uid: user.uid, username: user.username, role: user.role };
        const token = (0, jwtauth_1.generateToken)(payload, jwtauth_1.secret);
        res.json({
            message: "เข้าสู่ระบบสำเร็จ",
            token,
            user: {
                uid: user.uid,
                username: user.username,
                email: user.email,
                role: user.role,
                profile: user.profile,
            },
        });
    }
    catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// PUT (Edit) a user
exports.router.put("/:id", fileMiddleware_1.fileUpload.diskLoader.single("file"), async (req, res) => {
    try {
        const id = req.params.id;
        const userUpdate = req.body;
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM users WHERE uid = ?", [id]);
        const originalUser = rows[0];
        if (!originalUser)
            return res.status(404).json({ message: "User not found" });
        let profileUrl = originalUser.profile;
        if (req.file) {
            const result = await cloudinary_1.default.uploader.upload(req.file.path, {
                folder: "gamestore/profile"
            });
            profileUrl = result.secure_url;
            fs_1.default.unlinkSync(req.file.path);
        }
        let hashedPassword = originalUser.password;
        if (userUpdate.password) {
            hashedPassword = await bcrypt_1.default.hash(userUpdate.password, 10);
        }
        const sql = "UPDATE users SET username=?, email=?, password=?, profile=? WHERE uid=?";
        await dbconnect_1.conn.query(sql, [
            userUpdate.username || originalUser.username,
            userUpdate.email || originalUser.email,
            hashedPassword,
            profileUrl,
            id,
        ]);
        res.status(200).json({ message: "User updated successfully" });
    }
    catch (err) {
        console.error("PUT /user/:id error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// DELETE a user
exports.router.delete("/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const [rows] = await dbconnect_1.conn.query("SELECT profile FROM `users` WHERE uid = ?", [id]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        await dbconnect_1.conn.query("DELETE FROM `users` WHERE uid = ?", [id]);
        if (user.profile) {
            fileMiddleware_1.fileUpload.deleteFile(user.profile);
        }
        res.status(200).json({ message: "User deleted successfully" });
    }
    catch (err) {
        console.error("DELETE /user error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
