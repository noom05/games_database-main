"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const dbconnect_1 = require("../db/dbconnect");
// import { authMiddleware, adminMiddleware } from "../middleware/auth"; // (อนาคต) ควรเพิ่ม middleware ตรวจสอบสิทธิ์
exports.router = express_1.default.Router();
/**
 * [POST] /discount/
 * Admin: สร้างโค้ดส่วนลดใหม่
 */
exports.router.post("/", async (req, res) => {
    const { code, discount_type, discount_value, max_uses, expiry_date } = req.body;
    // ตรวจสอบข้อมูลพื้นฐาน
    if (!code || !discount_type || !discount_value || !max_uses) {
        return res.status(400).json({ error: "Code, type, value, and max_uses are required." });
    }
    try {
        const sql = "INSERT INTO discount_codes (code, discount_type, discount_value, max_uses, expiry_date, is_active) VALUES (?, ?, ?, ?, ?, TRUE)";
        const [result] = await dbconnect_1.conn.query(sql, [
            code.toUpperCase(), // บังคับเป็นพิมพ์ใหญ่
            discount_type,
            discount_value,
            max_uses,
            expiry_date || null
        ]);
        res.status(201).json({ id: result.insertId, message: "Discount code created" });
    }
    catch (err) {
        console.error("Create discount error:", err);
        // จัดการกรณีสร้างโค้ดซ้ำ
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "โค้ดนี้มีอยู่ในระบบแล้ว" });
        }
        res.status(500).json({ error: "Failed to create code", detail: err });
    }
});
/**
 * [GET] /discount/
 * Admin: ดึงโค้ดส่วนลดทั้งหมด
 */
exports.router.get("/", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM discount_codes ORDER BY created_at DESC");
        res.json(rows);
    }
    catch (err) {
        console.error("Get discounts error:", err);
        res.status(500).json({ error: "Failed to get codes", detail: err });
    }
});
/**
 * [GET] /discount/:id
 * Admin: ดึงข้อมูลโค้ด 1 ตัวเพื่อนำไปแก้ไข
 */
exports.router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM discount_codes WHERE id = ?", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Code not found" });
        }
        res.json(rows[0]);
    }
    catch (err) {
        console.error("Get code by id error:", err);
        res.status(500).json({ error: "Failed to get code", detail: err });
    }
});
/**
 * [PUT] /discount/:id
 * Admin: อัปเดตข้อมูลโค้ดส่วนลด
 */
exports.router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { discount_type, discount_value, max_uses, expiry_date, is_active } = req.body;
    if (!discount_type || !discount_value || !max_uses) {
        return res.status(400).json({ error: "Type, value, and max_uses are required." });
    }
    try {
        const sql = `
            UPDATE discount_codes 
            SET discount_type = ?, discount_value = ?, max_uses = ?, expiry_date = ?, is_active = ?
            WHERE id = ?
        `;
        const [result] = await dbconnect_1.conn.query(sql, [
            discount_type,
            discount_value,
            max_uses,
            expiry_date || null,
            is_active,
            id
        ]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Code not found" });
        }
        res.json({ message: "Discount code updated successfully" });
    }
    catch (err) {
        console.error("Update discount error:", err);
        res.status(500).json({ error: "Failed to update code", detail: err });
    }
});
/**
 * [DELETE] /discount/:id
 * Admin: ลบโค้ดส่วนลด
 */
exports.router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        // เราตั้งค่า ON DELETE CASCADE ไว้แล้ว
        // เมื่อลบโค้ดใน discount_codes, แถวใน user_discount_usage จะถูกลบตามไปด้วย
        const [result] = await dbconnect_1.conn.query("DELETE FROM discount_codes WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Code not found" });
        }
        res.json({ message: "Discount code deleted successfully" });
    }
    catch (err) {
        console.error("Delete discount error:", err);
        res.status(500).json({ error: "Failed to delete code", detail: err });
    }
});
/**
 * [POST] /discount/apply
 * User: ตรวจสอบโค้ดส่วนลด (ตอนกด "Apply" ในตะกร้า)
 */
// แก้ใหม่
exports.router.post("/apply", async (req, res) => {
    const { code, user_id } = req.body;
    if (!code || !user_id)
        return res.status(400).json({ error: "Code and User ID are required." });
    try {
        const [codeRows] = await dbconnect_1.conn.query("SELECT * FROM discount_codes WHERE code = ? AND is_active = TRUE", [code.toUpperCase()]);
        if (codeRows.length === 0)
            return res.status(404).json({ error: "โค้ดส่วนลดไม่ถูกต้อง" });
        const discountCode = codeRows[0];
        if (discountCode.expiry_date && new Date(discountCode.expiry_date) < new Date())
            return res.status(400).json({ error: "โค้ดส่วนลดนี้หมดอายุแล้ว" });
        if (discountCode.current_uses >= discountCode.max_uses)
            return res.status(400).json({ error: "โค้ดส่วนลดนี้ถูกใช้เต็มจำนวนแล้ว" });
        const [usageRows] = await dbconnect_1.conn.query("SELECT id FROM user_discount_usage WHERE user_id = ? AND code_id = ?", [user_id, discountCode.id]);
        if (usageRows.length > 0)
            return res.status(400).json({ error: "คุณใช้โค้ดส่วนลดนี้ไปแล้ว" });
        // บันทึกการใช้รหัส
        await dbconnect_1.conn.query("INSERT INTO user_discount_usage (user_id, code_id) VALUES (?, ?)", [user_id, discountCode.id]);
        await dbconnect_1.conn.query("UPDATE discount_codes SET current_uses = current_uses + 1 WHERE id = ?", [discountCode.id]);
        res.json({
            message: "ใช้โค้ดส่วนลดสำเร็จ",
            code: discountCode.code,
            discount_type: discountCode.discount_type,
            discount_value: discountCode.discount_value
        });
    }
    catch (err) {
        console.error("Apply code error:", err);
        res.status(500).json({ error: "Failed to apply code", detail: err });
    }
});
//test
/**
 * [GET] /discount/validate/:code
 * ตรวจสอบโค้ดส่วนลดแบบทั่วไป (ไม่ผูกกับ user)
 */
// router.get("/validate/:code", async (req, res) => {
//   const { code } = req.params;
//   if (!code) {
//     return res.status(400).json({ error: "ต้องระบุโค้ดส่วนลด" });
//   }
//   try {
//     const [rows] = await conn.query<RowDataPacket[]>(
//       "SELECT * FROM discount_codes WHERE code = ? AND is_active = TRUE",
//       [code.toUpperCase()]
//     );
//     if (rows.length === 0) {
//       return res.status(404).json({ valid: false, message: "โค้ดไม่ถูกต้อง" });
//     }
//     const discount = rows[0];
//     if (discount.expiry_date && new Date(discount.expiry_date) < new Date()) {
//       return res.status(400).json({ valid: false, message: "โค้ดหมดอายุแล้ว" });
//     }
//     if (discount.current_uses >= discount.max_uses) {
//       return res.status(400).json({ valid: false, message: "โค้ดถูกใช้เต็มจำนวนแล้ว" });
//     }
//     res.json({
//       valid: true,
//       code: discount.code,
//       discount_type: discount.discount_type,
//       discount_value: discount.discount_value,
//       message: "โค้ดสามารถใช้งานได้"
//     });
//   } catch (err) {
//     console.error("Validate code error:", err);
//     res.status(500).json({ error: "ตรวจสอบโค้ดไม่สำเร็จ" });
//   }
// });
