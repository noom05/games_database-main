import express from "express";
import { conn } from "../dist/dbconnect";
import { Users } from "../model/user";
import mysql from "mysql2";
import bcrypt from "bcrypt";
import { fileUpload } from "../middleware/fileMiddleware";
import { verifyToken } from "../middleware/verifyToken";
import { authorizeRole } from "../middleware/authorize";  
import { generateToken, secret } from "../auth/jwtauth";

export const router = express.Router();

/////-------------Users---------------//////
//get all user
router.get("/", verifyToken, authorizeRole(["admin"]), async (req, res) => {
  try {
    const [rows] = await conn.query("SELECT * FROM users");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cannot read users data" });
  }
});

//get user by id
router.get("/:id", async (req, res) => {
  try {
    const id = +req.params.id;

    const [rows] = await conn.query("SELECT * FROM users WHERE uid = ?", [id]);
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

router.post(
  "/",
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

      // 2️⃣ สร้าง JWT token
      const payload = {
        uid: info.insertId,
        username: user.username,
        role: "user", // default role เป็น user
      };
      const token = generateToken(payload, secret);

      // 3️⃣ ส่ง response พร้อม token
      res.status(201).json({
        message: "สมัครสมาชิกสำเร็จ",
        token,
        user: {
          uid: info.insertId,
          username: user.username,
          email: user.email,
          profile: profileFilename,
          role: "user",
        },
      });
    } catch (err) {
      console.error("POST /user/register error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

//delete
router.delete(
  "/:id",
  verifyToken,
  authorizeRole(["admin"]),
  async (req, res) => {
    try {
      const id = +req.params.id;

      // 1️⃣ ดึงชื่อไฟล์จาก DB ก่อน
      const [rows] = await conn.query(
        "SELECT profile FROM `users` WHERE uid = ?",
        [id]
      );
      const user = (rows as any[])[0];

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // 2️⃣ ลบ record จาก DB
      const [result] = await conn.query("DELETE FROM `users` WHERE uid = ?", [
        id,
      ]);
      const info = result as mysql.ResultSetHeader;

      // 3️⃣ ลบไฟล์จริง โดยเรียก method จาก fileMiddleware
      if (user.profile) {
        fileUpload.deleteFile(user.profile);
      }

      res.status(200).json({ affected_row: info.affectedRows });
    } catch (err) {
      console.error("DELETE /user error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.put(
  "/:id",
  fileUpload.diskLoader.single("file"), // ✅ รองรับ upload รูปใหม่
  async (req, res) => {
    try {
      const id = +req.params.id;
      const user: Partial<Users> = req.body;

      // 1️⃣ ดึงข้อมูลผู้ใช้เดิม
      const [rows] = await conn.query("SELECT * FROM users WHERE uid = ?", [id]);
      const result = rows as Users[];

      if (result.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const original = result[0];

      // 2️⃣ ถ้ามีไฟล์ใหม่ อัปเดตชื่อไฟล์ใหม่ และลบไฟล์เก่า
      let profileFilename = original.profile;
      if (req.file) {
        // ลบไฟล์เก่าถ้ามี
        if (original.profile) {
          fileUpload.deleteFile(original.profile);
        }
        profileFilename = req.file.filename;
      }

      // 3️⃣ ถ้ามีการเปลี่ยนรหัสผ่าน
      let hashedPassword = original.password;
      if (user.password) {
        hashedPassword = await bcrypt.hash(user.password, 10);
      }

      // 4️⃣ รวมข้อมูลเดิม + ใหม่
      const update = {
        ...original,
        ...user,
        password: hashedPassword,
        profile: profileFilename,
      };

      // 5️⃣ อัปเดต DB
      const sql =
        "UPDATE users SET username=?, email=?, password=?, profile=? WHERE uid=?";
      const formattedSql = mysql.format(sql, [
        update.username,
        update.email,
        update.password,
        update.profile,
        id,
      ]);

      const [updateResult] = await conn.query(formattedSql);
      const info = updateResult as mysql.ResultSetHeader;

      res.status(200).json({
        affected_row: info.affectedRows,
        new_profile: update.profile,
      });
    } catch (err) {
      console.error("PUT /user/:id error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

//login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. ตรวจสอบผู้ใช้
    const [rows] = await conn.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    if ((rows as any[]).length === 0)
      return res.status(401).json({ error: "ไม่พบชื่อผู้ใช้ในระบบ" });

    const user = (rows as any[])[0];

    // 2. ตรวจสอบรหัสผ่าน
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("match:", isMatch);
    if (!isMatch) return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });

    // 3. สร้าง JWT payload
    const payload = {
      uid: user.uid,
      username: user.username,
      role: user.role, // สำคัญสำหรับแยกสิทธิ์
    };

    // 4. สร้าง token
    const token = generateToken(payload, secret);

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
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});