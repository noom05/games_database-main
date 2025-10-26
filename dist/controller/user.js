"use strict";
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
const jwtauth_1 = require("../auth/jwtauth");
exports.router = express_1.default.Router();
/////-------------Users---------------//////
//get all user
exports.router.get("/", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM users");
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Cannot read users data" });
    }
});
//get user by id
exports.router.get("/:id", async (req, res) => {
    try {
        const id = +req.params.id;
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM users WHERE uid = ?", [id]);
        const users = rows;
        if (users.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        const user = users[0];
        res.json(user);
    }
    catch (err) {
        console.error("GET /user/:id error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
//register
exports.router.post("/register", fileMiddleware_1.fileUpload.diskLoader.single("file"), // multer middleware
async (req, res) => {
    try {
        const user = req.body;
        const profileFilename = req.file ? req.file.filename : null;
        const hashedPassword = await bcrypt_1.default.hash(user.password, 10);
        // เพิ่ม user ลง DB
        const sql = "INSERT INTO `users`(`username`,`email`,`password`,`profile`) VALUES (?,?,?,?)";
        const formattedSql = mysql2_1.default.format(sql, [
            user.username,
            user.email,
            hashedPassword,
            profileFilename,
        ]);
        const [result] = await dbconnect_1.conn.query(formattedSql);
        const info = result;
        // สร้าง Wallet ให้ user ใหม่ (balance จะเป็น 0 ตาม DEFAULT)
        await dbconnect_1.conn.query("INSERT INTO wallet (user_id) VALUES (?)", [
            info.insertId,
        ]);
        // ส่ง response
        res.status(201).json({
            message: "สมัครสมาชิกสำเร็จ",
            user: {
                uid: info.insertId,
                username: user.username,
                email: user.email,
                profile: profileFilename,
                role: "user",
                balance: 0, // จะมี wallet พร้อม balance 0 ทันที
            },
        });
    }
    catch (err) {
        console.error("POST /user/register error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
//delete
exports.router.delete("/:id", async (req, res) => {
    try {
        const id = +req.params.id;
        // ดึงชื่อไฟล์จาก DB ก่อน
        const [rows] = await dbconnect_1.conn.query("SELECT profile FROM `users` WHERE uid = ?", [id]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // ลบ record จาก DB
        const [result] = await dbconnect_1.conn.query("DELETE FROM `users` WHERE uid = ?", [
            id,
        ]);
        const info = result;
        // ลบไฟล์จริง โดยเรียก method จาก fileMiddleware
        if (user.profile) {
            fileMiddleware_1.fileUpload.deleteFile(user.profile);
        }
        res.status(200).json({ affected_row: info.affectedRows });
    }
    catch (err) {
        console.error("DELETE /user error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
//edit
exports.router.put("/:id", fileMiddleware_1.fileUpload.diskLoader.single("file"), // รองรับ upload รูปใหม่
async (req, res) => {
    try {
        const id = +req.params.id;
        const user = req.body;
        // ดึงข้อมูลผู้ใช้เดิม
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM users WHERE uid = ?", [
            id,
        ]);
        const result = rows;
        if (result.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        const original = result[0];
        // ถ้ามีไฟล์ใหม่ อัปเดตชื่อไฟล์ใหม่ และลบไฟล์เก่า
        let profileFilename = original.profile;
        if (req.file) {
            // ลบไฟล์เก่าถ้ามี
            if (original.profile) {
                fileMiddleware_1.fileUpload.deleteFile(original.profile);
            }
            profileFilename = req.file.filename;
        }
        // ถ้ามีการเปลี่ยนรหัสผ่าน
        let hashedPassword = original.password;
        if (user.password) {
            hashedPassword = await bcrypt_1.default.hash(user.password, 10);
        }
        // รวมข้อมูลเดิม + ใหม่
        const update = {
            ...original,
            ...user,
            password: hashedPassword,
            profile: profileFilename,
        };
        // อัปเดต DB
        const sql = "UPDATE users SET username=?, email=?, password=?, profile=? WHERE uid=?";
        const formattedSql = mysql2_1.default.format(sql, [
            update.username,
            update.email,
            update.password,
            update.profile,
            id,
        ]);
        const [updateResult] = await dbconnect_1.conn.query(formattedSql);
        const info = updateResult;
        res.status(200).json({
            affected_row: info.affectedRows,
            new_profile: update.profile || null,
        });
    }
    catch (err) {
        console.error("PUT /user/:id error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
//login
exports.router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        // 1. ตรวจสอบผู้ใช้
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM users WHERE username = ?", [
            username,
        ]);
        if (rows.length === 0)
            return res.status(401).json({ error: "ไม่พบชื่อผู้ใช้ในระบบ" });
        const user = rows[0];
        // 2. ตรวจสอบรหัสผ่าน
        const isMatch = await bcrypt_1.default.compare(password, user.password);
        if (!isMatch)
            return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
        // 3. สร้าง JWT payload
        const payload = {
            uid: user.uid,
            username: user.username,
            role: user.role, // สำคัญสำหรับแยกสิทธิ์
        };
        // 4. สร้าง token
        const token = (0, jwtauth_1.generateToken)(payload, jwtauth_1.secret);
        // 5. ส่ง response
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
////-------User Management------/////
//get wallet balance
exports.router.get("/wallet/:id", async (req, res) => {
    const userId = +req.params.id;
    const [rows] = await dbconnect_1.conn.query("SELECT balance FROM wallet WHERE user_id = ?", [userId]);
    // ถ้าไม่มี wallet -> สร้างให้เลย พร้อม default balance = 0
    if (rows.length === 0) {
        await dbconnect_1.conn.query("INSERT INTO wallet (user_id) VALUES (?)", [userId]); // balance จะเป็น 0 ตาม DEFAULT
        return res.json({ balance: 0 });
    }
    res.json(rows[0]);
});
// POST Top-up Wallet (ปลอดภัย + กัน race condition + validate amount)
exports.router.post("/wallet/topup", async (req, res) => {
    const { user_id, amount } = req.body;
    // --- Validate Input ---
    const parsedAmount = Number(amount);
    if (!user_id || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid user_id or amount" });
    }
    const connection = await dbconnect_1.conn.getConnection();
    try {
        await connection.beginTransaction();
        // Lock wallet row เพื่อป้องกัน race condition
        const [rows] = await connection.query("SELECT balance FROM wallet WHERE user_id = ? FOR UPDATE", [user_id]);
        if (rows.length === 0) {
            // ถ้า wallet ยังไม่มี -> สร้างใหม่
            await connection.query("INSERT INTO wallet (user_id, balance) VALUES (?, ?)", [user_id, parsedAmount]);
        }
        else {
            // เพิ่มยอดเงิน
            await connection.query("UPDATE wallet SET balance = balance + ? WHERE user_id = ?", [parsedAmount, user_id]);
        }
        // บันทึก transaction
        await connection.query("INSERT INTO transaction (user_id, type, amount) VALUES (?, 'topup', ?)", [user_id, parsedAmount]);
        await connection.commit();
        // ดึงยอดล่าสุดกลับไป
        const [updatedRows] = await connection.query("SELECT balance FROM wallet WHERE user_id = ?", [user_id]);
        res.json({
            message: "Top-up successful",
            balance: updatedRows[0].balance,
        });
    }
    catch (err) {
        await connection.rollback();
        console.error("Top-up failed:", err);
        res.status(500).json({ error: "Top-up failed", detail: err.message });
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
            if (code.discount_type === "percent") {
                final_price =
                    original_price - original_price * (code.discount_value / 100);
            }
            else if (code.discount_type === "fixed") {
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
        const [gameRows] = await dbconnect_1.conn.query("SELECT * FROM games WHERE id = ?", [gameId]);
        if (gameRows.length === 0) {
            return res.status(404).json({ error: "Game not found" });
        }
        // ตรวจสอบว่าผู้ใช้ซื้อเกมนี้แล้วหรือยัง
        const [purchaseRows] = await dbconnect_1.conn.query(`SELECT * FROM transaction 
       WHERE user_id = ? AND game_id = ? AND type = 'purchase'`, [userId, gameId]);
        const isPurchased = purchaseRows.length > 0;
        // ส่งข้อมูลทั้งหมด
        res.json({
            game: gameRows[0],
            isPurchased,
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
// get game library
exports.router.get("/library/:userId", async (req, res) => {
    const userId = +req.params.userId;
    try {
        const [rows] = await dbconnect_1.conn.query(`
      SELECT 
        g.id,
        g.game_name,
        g.image,
        g.price,
        g.description,
        g.release_date
      FROM transaction t
      JOIN games g ON t.game_id = g.id
      WHERE t.user_id = ? AND t.type = 'purchase'
      GROUP BY g.id
      `, [userId]);
        res.json(rows);
    }
    catch (err) {
        console.error("GET /library error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
//เพิ่มใหม่
// เพิ่มเกมลงรถเข็น
exports.router.post("/cart/add", async (req, res) => {
    const { user_id, game_id } = req.body;
    if (!user_id || !game_id)
        return res.status(400).json({ error: "Missing user_id or game_id" });
    try {
        // ตรวจสอบว่าเกมนี้อยู่ในรถเข็นแล้วหรือยัง
        const [exists] = await dbconnect_1.conn.query("SELECT * FROM cart WHERE user_id = ? AND game_id = ?", [user_id, game_id]);
        if (exists.length > 0) {
            return res.status(400).json({ message: "เกมนี้อยู่ในรถเข็นแล้ว" });
        }
        await dbconnect_1.conn.query("INSERT INTO cart (user_id, game_id) VALUES (?, ?)", [
            user_id,
            game_id,
        ]);
        res.json({ message: "เพิ่มเกมลงรถเข็นแล้ว" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// ดึงรายการในรถเข็นของผู้ใช้
exports.router.get("/cart/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await dbconnect_1.conn.query(`
      SELECT g.id, g.game_name, g.price, g.image
      FROM cart c
      JOIN games g ON c.game_id = g.id
      WHERE c.user_id = ?
      `, [userId]);
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// ลบเกมออกจากรถเข็น
exports.router.delete("/cart/remove", async (req, res) => {
    const { user_id, game_id } = req.body;
    try {
        await dbconnect_1.conn.query("DELETE FROM cart WHERE user_id = ? AND game_id = ?", [
            user_id,
            game_id,
        ]);
        res.json({ message: "ลบเกมออกจากรถเข็นแล้ว" });
    }
    catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});
//กดซื้อเกมทั้งหมดในที่เดียว
exports.router.post("/cart/checkout", async (req, res) => {
    const { user_id, discount_code } = req.body;
    const connection = await dbconnect_1.conn.getConnection();
    try {
        // ดึงเกมในรถเข็นพร้อมราคาจริง
        const [cartItems] = await connection.query(`SELECT c.game_id, g.price
       FROM cart c
       JOIN games g ON c.game_id = g.id
       WHERE c.user_id = ?`, [user_id]);
        if (cartItems.length === 0)
            return res.status(400).json({ message: "รถเข็นของคุณว่างเปล่า" });
        await connection.beginTransaction();
        // ตรวจสอบ Wallet
        const [wallet] = await connection.query("SELECT balance FROM wallet WHERE user_id = ?", [user_id]);
        const balance = wallet[0]?.balance || 0;
        // ตรวจสอบส่วนลด
        let discountValue = 0;
        let discountType = null;
        let discountCodeId = null;
        if (discount_code) {
            const [codeRows] = await connection.query("SELECT * FROM discount_codes WHERE code = ? AND is_active = TRUE", [discount_code.toUpperCase()]);
            if (codeRows.length > 0) {
                const discount = codeRows[0];
                discountCodeId = discount.id;
                discountType = discount.discount_type;
                discountValue = discount.discount_value;
                // เช็คหมดอายุและจำนวนใช้แล้ว
                if (discount.expiry_date && new Date(discount.expiry_date) < new Date())
                    throw new Error("โค้ดส่วนลดหมดอายุ");
                if (discount.current_uses >= discount.max_uses)
                    throw new Error("โค้ดส่วนลดถูกใช้เต็มจำนวนแล้ว");
            }
        }
        // คำนวณ total price
        let totalPrice = cartItems.reduce((sum, item) => sum + item.price, 0);
        // ใช้ส่วนลด
        if (discountType === "percent") {
            totalPrice = totalPrice * (1 - discountValue / 100);
        }
        else if (discountType === "fixed") {
            totalPrice = totalPrice - discountValue;
        }
        if (totalPrice < 0)
            totalPrice = 0;
        if (balance < totalPrice) {
            await connection.rollback();
            return res.status(400).json({ message: "ยอดเงินไม่เพียงพอ" });
        }
        // ลดเงินใน Wallet
        await connection.query("UPDATE wallet SET balance = balance - ? WHERE user_id = ?", [totalPrice, user_id]);
        // สร้าง finalPrices สำหรับบันทึก transaction
        const finalPrices = cartItems.map((item) => {
            let price = item.price;
            if (discountType === "percent")
                price = price * (1 - discountValue / 100);
            // fixed discount แบ่งตามสัดส่วนของเกมแต่ละตัว
            else if (discountType === "fixed") {
                const proportion = item.price / cartItems.reduce((sum, i) => sum + i.price, 0);
                price = item.price - discountValue * proportion;
            }
            if (price < 0)
                price = 0;
            return { game_id: item.game_id, finalPrice: price };
        });
        // เพิ่ม Transaction และอัปเดต total_sales
        for (const item of finalPrices) {
            await connection.query("INSERT INTO transaction (user_id, game_id, amount, type, discount_code_id) VALUES (?, ?, ?, 'purchase', ?)", [user_id, item.game_id, item.finalPrice, discountCodeId]);
            await connection.query("UPDATE games SET total_sales = total_sales + 1 WHERE id = ?", [item.game_id]);
        }
        // เพิ่มการใช้โค้ดส่วนลด (ถ้ามี) แต่เช็ก duplicate ก่อน
        if (discountCodeId) {
            const [usageRows] = await connection.query("SELECT id FROM user_discount_usage WHERE user_id = ? AND code_id = ?", [user_id, discountCodeId]);
            if (usageRows.length === 0) {
                await connection.query("INSERT INTO user_discount_usage (user_id, code_id) VALUES (?, ?)", [user_id, discountCodeId]);
                await connection.query("UPDATE discount_codes SET current_uses = current_uses + 1 WHERE id = ?", [discountCodeId]);
            }
        }
        // ลบเกมในรถเข็น
        await connection.query("DELETE FROM cart WHERE user_id = ?", [user_id]);
        await connection.commit();
        res.json({ message: "ซื้อเกมทั้งหมดเรียบร้อยแล้ว!" });
    }
    catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
    finally {
        connection.release();
    }
});
//เช็คเกมในรถเข็น
exports.router.get("/cart/has/:userId/:gameId", async (req, res) => {
    const { userId, gameId } = req.params;
    const [rows] = await dbconnect_1.conn.query("SELECT id FROM cart WHERE user_id = ? AND game_id = ? LIMIT 1", [userId, gameId]);
    res.json({ inCart: rows.length > 0 });
});
