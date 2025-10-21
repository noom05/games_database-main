import express from "express";
import { conn } from "../db/dbconnect";
import { RowDataPacket, ResultSetHeader } from "mysql2";
// import { authMiddleware, adminMiddleware } from "../middleware/auth"; // (อนาคต) ควรเพิ่ม middleware ตรวจสอบสิทธิ์

export const router = express.Router();

// =================================================================
// ==                      ADMIN ROUTES (ข้อ 5.1, 5.2)           ==
// =================================================================

/**
 * [POST] /discount/
 * Admin: สร้างโค้ดส่วนลดใหม่
 */
// (ในอนาคต ควรใส่ adminMiddleware มาคั่น)
router.post("/", async (req, res) => {
    const { code, discount_type, discount_value, max_uses, expiry_date } = req.body;
    
    // ตรวจสอบข้อมูลพื้นฐาน
    if (!code || !discount_type || !discount_value || !max_uses) {
        return res.status(400).json({ error: "Code, type, value, and max_uses are required." });
    }

    try {
        const sql = "INSERT INTO discount_codes (code, discount_type, discount_value, max_uses, expiry_date, is_active) VALUES (?, ?, ?, ?, ?, TRUE)";
        const [result] = await conn.query<ResultSetHeader>(sql, [
            code.toUpperCase(), // บังคับเป็นพิมพ์ใหญ่
            discount_type, 
            discount_value, 
            max_uses, 
            expiry_date || null
        ]);
        res.status(201).json({ id: result.insertId, message: "Discount code created" });
    } catch (err: any) {
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
// (ในอนาคต ควรใส่ adminMiddleware มาคั่น)
router.get("/", async (req, res) => {
    try {
        const [rows] = await conn.query("SELECT * FROM discount_codes ORDER BY created_at DESC");
        res.json(rows);
    } catch (err) {
        console.error("Get discounts error:", err);
        res.status(500).json({ error: "Failed to get codes", detail: err });
    }
});

/**
 * [GET] /discount/:id
 * Admin: ดึงข้อมูลโค้ด 1 ตัวเพื่อนำไปแก้ไข
 */
// (ควรใส่ adminMiddleware)
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM discount_codes WHERE id = ?", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Code not found" });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error("Get code by id error:", err);
        res.status(500).json({ error: "Failed to get code", detail: err });
    }
});


/**
 * [PUT] /discount/:id
 * Admin: อัปเดตข้อมูลโค้ดส่วนลด
 */
// (ควรใส่ adminMiddleware)
router.put("/:id", async (req, res) => {
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
        const [result] = await conn.query<ResultSetHeader>(sql, [
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
    } catch (err) {
        console.error("Update discount error:", err);
        res.status(500).json({ error: "Failed to update code", detail: err });
    }
});

/**
 * [DELETE] /discount/:id
 * Admin: ลบโค้ดส่วนลด
 */
// (ในอนาคต ควรใส่ adminMiddleware มาคั่น)
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        // เราตั้งค่า ON DELETE CASCADE ไว้แล้ว
        // เมื่อลบโค้ดใน discount_codes, แถวใน user_discount_usage จะถูกลบตามไปด้วย
        const [result] = await conn.query<ResultSetHeader>("DELETE FROM discount_codes WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Code not found" });
        }
        res.json({ message: "Discount code deleted successfully" });
    } catch (err) {
        console.error("Delete discount error:", err);
        res.status(500).json({ error: "Failed to delete code", detail: err });
    }
});


// =================================================================
// ==                      USER ROUTES (ข้อ 5.3, 5.4)             ==
// =================================================================

/**
 * [POST] /discount/apply
 * User: ตรวจสอบโค้ดส่วนลด (ตอนกด "Apply" ในตะกร้า)
 */
// (ในอนาคต ควรใส่ authMiddleware เพื่อดึง user_id จาก token)
router.post("/apply", async (req, res) => {
    // หมายเหตุ: user_id ควรสลับไปดึงจาก token (req.user.uid) แทนที่จะรับจาก body เพื่อความปลอดภัย
    const { code, user_id } = req.body; 
    
    if (!code || !user_id) {
        return res.status(400).json({ error: "Code and User ID are required." });
    }

    try {
        // 1. หาโค้ด
        const [codeRows] = await conn.query<RowDataPacket[]>(
            "SELECT * FROM discount_codes WHERE code = ? AND is_active = TRUE",
            [code.toUpperCase()]
        );
        
        if (codeRows.length === 0) {
            return res.status(404).json({ error: "โค้ดส่วนลดไม่ถูกต้อง" });
        }
        
        const discountCode = codeRows[0];

        // 2. เช็คว่าโค้ดหมดอายุหรือยัง
        if (discountCode.expiry_date && new Date(discountCode.expiry_date) < new Date()) {
            return res.status(400).json({ error: "โค้ดส่วนลดนี้หมดอายุแล้ว" });
        }

        // 3. เช็คว่าโค้ดถูกใช้เต็มจำนวนหรือยัง (ข้อ 5.2)
        if (discountCode.current_uses >= discountCode.max_uses) {
            return res.status(400).json({ error: "โค้ดส่วนลดนี้ถูกใช้เต็มจำนวนแล้ว" });
        }

        // 4. เช็คว่า User นี้เคยใช้โค้ดนี้หรือยัง (ข้อ 5.3)
        const [usageRows] = await conn.query<RowDataPacket[]>(
            "SELECT id FROM user_discount_usage WHERE user_id = ? AND code_id = ?",
            [user_id, discountCode.id]
        );

        if (usageRows.length > 0) {
            return res.status(400).json({ error: "คุณใช้โค้ดส่วนลดนี้ไปแล้ว" });
        }

        // ถ้าผ่านทุกเงื่อนไข = ใช้งานได้
        res.json({
            message: "ใช้โค้ดส่วนลดสำเร็จ",
            code: discountCode.code,
            discount_type: discountCode.discount_type,
            discount_value: discountCode.discount_value
        });

    } catch (err) {
        console.error("Apply code error:", err);
        res.status(500).json({ error: "Failed to apply code", detail: err });
    }
});