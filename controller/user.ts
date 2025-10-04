import express from "express";
import { conn } from "../db/dbconnect";
import { Users } from "../model/user";
import mysql from "mysql2";
import bcrypt from "bcrypt";
import { fileUpload } from "../middleware/fileMiddleware";

export const router = express.Router();

/////-------------Users---------------//////

router.get("/", async (req, res) => {
  try {
    const [rows] = await conn.query("SELECT * FROM users");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cannot read users data" });
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

      res.status(201).json({
        affected_row: info.affectedRows,
        last_idx: info.insertId,
        profile: profileFilename,
      });
    } catch (err) {
      console.error("POST /user error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.delete("/:id", async (req, res) => {
  try {
    const id = +req.params.id;

    // 1️⃣ ดึงชื่อไฟล์จาก DB ก่อน
    const [rows] = await conn.query("SELECT profile FROM `users` WHERE uid = ?", [id]);
    const user = (rows as any[])[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ ลบ record จาก DB
    const [result] = await conn.query("DELETE FROM `users` WHERE uid = ?", [id]);
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
});

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