import express from "express";
import { conn } from "../db/dbconnect";
import { Users } from "../model/user";
import mysql from "mysql2";
import bcrypt from "bcrypt";
import { fileUpload } from "../middleware/fileMiddleware";
// 1. Import ฟังก์ชันสำหรับสร้าง Token เข้ามา
import { generateToken, secret } from "../auth/jwtauth";

export const router = express.Router();

/////-------------Users---------------//////

// GET all users
router.get("/", async (req, res) => {
  try {
    const [rows] = await conn.query("SELECT uid, username, email, role, profile FROM users");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cannot read users data" });
  }
});

// GET user by id
router.get("/:id", async (req, res) => {
    try {
        // ใน Git ของคุณใช้ uid ซึ่งน่าจะเป็น string, ไม่ใช่ number
        const id = req.params.id; 

        const [rows] = await conn.query("SELECT uid, username, email, role, profile FROM users WHERE uid = ?", [id]);
        const users = rows as any[];

        if (users.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = users[0];
        res.json(user);
    } catch (err) {
        console.error("GET /user/:id error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST (Register)
router.post(
  "/register",
  fileUpload.diskLoader.single("file"), // multer middleware
  async (req, res) => {
    try {
      const user: Users = req.body;
      const profileFilename = req.file ? req.file.filename : null;
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const sql =
        "INSERT INTO `users`(`username`,`email`,`password`,`profile`) VALUES (?,?,?,?)";
      const formattedSql = mysql.format(sql, [
        user.username,
        user.email,
        hashedPassword,
        profileFilename,
      ]);

      const [result] = await conn.query(formattedSql);
      const info = result as mysql.ResultSetHeader;

      res.status(201).json({
        message: "สมัครสมาชิกสำเร็จ",
        user: {
          uid: info.insertId, // Note: This might not be the correct UID if it's a UUID/string
          username: user.username,
          email: user.email,
          profile: profileFilename,
          role: "user",
        },
      });
    } catch (err) {
      console.error("POST /user/register error:", err);
      // ตรวจจับ Error กรณี username/email ซ้ำ
      if ((err as any).code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่แล้วในระบบ' });
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST (Login)
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
    }

    try {
        const [rows] = await conn.query("SELECT * FROM users WHERE username = ?", [username]);
        const users = rows as any[];

        if (users.length === 0) {
            return res.status(401).json({ error: "ไม่พบชื่อผู้ใช้ในระบบ" });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
        }

        // 2. สร้าง Payload สำหรับใส่ใน Token
        const payload = {
            uid: user.uid,
            username: user.username,
            role: user.role
        };

        // 3. สร้าง Token
        const token = generateToken(payload, secret);

        // 4. ส่ง Response กลับไปพร้อมกับ user และ token
        res.json({
            message: "เข้าสู่ระบบสำเร็จ",
            user: {
                uid: user.uid,
                username: user.username,
                email: user.email,
                role: user.role,
                profile: user.profile,
            },
            token: token // <-- เพิ่ม Token เข้าไปใน Response ตรงนี้
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// DELETE user
router.delete("/:id", async (req, res) => {
    // โค้ดส่วนนี้จาก Git ของคุณถูกต้องแล้ว
    try {
        const id = req.params.id;
        const [rows] = await conn.query("SELECT profile FROM `users` WHERE uid = ?", [id]);
        const user = (rows as any[])[0];

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await conn.query("DELETE FROM `users` WHERE uid = ?", [id]);

        if (user.profile) {
            fileUpload.deleteFile(user.profile);
        }

        res.status(200).json({ message: "User deleted successfully" });
    } catch (err) {
        console.error("DELETE /user error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// PUT (Edit) user
router.put("/:id", fileUpload.diskLoader.single("file"), async (req, res) => {
    // โค้ดส่วนนี้จาก Git ของคุณถูกต้องแล้ว
    try {
        const id = req.params.id;
        const userUpdateData: Partial<Users> = req.body;

        const [rows] = await conn.query("SELECT * FROM users WHERE uid = ?", [id]);
        const originalUser = (rows as any[])[0];

        if (!originalUser) {
            return res.status(404).json({ message: "User not found" });
        }

        let profileFilename = originalUser.profile;
        if (req.file) {
            if (originalUser.profile) {
                fileUpload.deleteFile(originalUser.profile);
            }
            profileFilename = req.file.filename;
        }

        let hashedPassword = originalUser.password;
        if (userUpdateData.password) {
            hashedPassword = await bcrypt.hash(userUpdateData.password, 10);
        }

        const sql = "UPDATE users SET username=?, email=?, password=?, profile=? WHERE uid=?";
        await conn.query(sql, [
            userUpdateData.username || originalUser.username,
            userUpdateData.email || originalUser.email,
            hashedPassword,
            profileFilename,
            id,
        ]);

        res.status(200).json({ message: "User updated successfully" });
    } catch (err) {
        console.error("PUT /user/:id error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

