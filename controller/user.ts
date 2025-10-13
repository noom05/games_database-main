import express from "express";
import { conn } from "../db/dbconnect";
import { Users } from "../model/user";
import mysql, { ResultSetHeader, RowDataPacket } from "mysql2";
import bcrypt from "bcrypt";
import { fileUpload } from "../middleware/fileMiddleware";
import { generateToken, secret } from "../auth/jwtauth";

// import cloudinary from "../cloudinary";
import fs from "fs";

export const router = express.Router();

// --- User Management Routes ---

// GET all users
router.get("/", async (req, res) => {
  try {
    const [rows] = await conn.query(
      "SELECT uid, username, email, role, profile FROM users"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cannot read users data" });
  }
});

// --- Wallet & Transaction Routes ---

// GET Wallet Balance
router.get("/wallet/:id", async (req, res) => {
  const userId = req.params.id;
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT balance FROM wallet WHERE user_id = ?",
    [userId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "Wallet not found" });
  }
  res.json(rows[0]);
});

// POST Top-up Wallet
router.post("/wallet/topup", async (req, res) => {
  const { user_id, amount } = req.body;
  const connection = await conn.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT balance FROM wallet WHERE user_id = ? FOR UPDATE",
      [user_id]
    );

    if (rows.length === 0) {
      await connection.query(
        "INSERT INTO wallet (user_id, balance) VALUES (?, ?)",
        [user_id, amount]
      );
    } else {
      await connection.query(
        "UPDATE wallet SET balance = balance + ? WHERE user_id = ?",
        [amount, user_id]
      );
    }

    await connection.query(
      "INSERT INTO transaction (user_id, type, amount) VALUES (?, 'topup', ?)",
      [user_id, amount]
    );
    await connection.commit();
    res.json({ message: "Top-up successful" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: "Top-up failed", detail: err });
  } finally {
    connection.release();
  }
});

// POST Purchase Game
router.post("/wallet/purchase", async (req, res) => {
  const { user_id, game_id } = req.body;
  const connection = await conn.getConnection();
  try {
    await connection.beginTransaction();

    const [gameRows] = await connection.query<RowDataPacket[]>(
      "SELECT id, game_name, price FROM games WHERE id = ? FOR UPDATE",
      [game_id]
    );
    const [walletRows] = await connection.query<RowDataPacket[]>(
      "SELECT balance FROM wallet WHERE user_id = ? FOR UPDATE",
      [user_id]
    );

    if (gameRows.length === 0) throw new Error("Game not found");
    if (walletRows.length === 0) throw new Error("Wallet not found");

    const game = gameRows[0];
    const wallet = walletRows[0];

    const [duplicateCheck] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM transaction WHERE user_id = ? AND game_id = ? AND type = 'purchase'",
      [user_id, game_id]
    );
    if (duplicateCheck.length > 0) {
      throw new Error("You already purchased this game");
    }

    if (wallet.balance < game.price) {
      throw new Error("Not enough balance");
    }

    await connection.query(
      "UPDATE wallet SET balance = balance - ? WHERE user_id = ?",
      [game.price, user_id]
    );

    const [updatedWallet] = await connection.query<RowDataPacket[]>(
      "SELECT balance FROM wallet WHERE user_id = ?",
      [user_id]
    );

    const [transactionResult] = await connection.query<ResultSetHeader>(
      "INSERT INTO transaction (user_id, type, amount, game_id) VALUES (?, 'purchase', ?, ?)",
      [user_id, game.price, game_id]
    );

    await connection.commit();

    res.json({
      message: "Purchase successful",
      balance: updatedWallet[0].balance,
    });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// GET User's Transaction History
router.get("/history/:id", async (req, res) => {
  const userId = req.params.id;
  const [rows] = await conn.query(
    `SELECT t.*, g.game_name 
         FROM transaction t
         LEFT JOIN games g ON t.game_id = g.id
         WHERE t.user_id = ?
         ORDER BY t.transaction_date DESC`,
    [userId]
  );
  res.json(rows);
});

// GET All Transactions (For Admin)
router.get("/admin/history", async (req, res) => {
  const [rows] = await conn.query(
    `SELECT t.*, u.username, g.game_name 
         FROM transaction t
         LEFT JOIN users u ON t.user_id = u.uid
         LEFT JOIN games g ON t.game_id = g.id
         ORDER BY t.transaction_date DESC`
  );
  res.json(rows);
});

// GET user by id
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await conn.query(
      "SELECT uid, username, email, role, profile FROM users WHERE uid = ?",
      [id]
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(users[0]);
  } catch (err) {
    console.error("GET /user/:id error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST (Register) a new user
router.post(
  "/register",
  fileUpload.diskLoader.single("file"),
  async (req, res) => {
    try {
      const user: Users = req.body;
      const profileFilename = req.file ? req.file.filename : null;
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const sql =
        "INSERT INTO `users`(`username`,`email`,`password`,`profile`, `role`) VALUES (?,?,?,?,'user')";
      const [result] = await conn.query(sql, [
        user.username,
        user.email,
        hashedPassword,
        profileFilename,
      ]);
      const info = result as mysql.ResultSetHeader;

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
    } catch (err) {
      console.error("POST /user/register error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST (Login)
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await conn.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    if ((rows as any[]).length === 0)
      return res.status(401).json({ error: "ไม่พบชื่อผู้ใช้ในระบบ" });

    const user = (rows as any[])[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });

    const payload = { uid: user.uid, username: user.username, role: user.role };
    const token = generateToken(payload, secret);

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

// PUT (Edit) a user
router.put(
  "/:id",
  fileUpload.diskLoader.single("file"),
  async (req, res) => {
    try {
      const id = +req.params.id;
      // req.body มาจาก multipart -> ค่าเป็น string
      const { username, email, password } = req.body as {
        username?: string;
        email?: string;
        password?: string;
      };

      // ดึง user เดิม
      const [rows] = await conn.query("SELECT * FROM users WHERE uid = ?", [id]);
      const result = rows as any[];
      if (result.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      const original = result[0];

      // logging ชั่วคราวสำหรับดีบัก
      console.log("PUT /user/:id - id:", id);
      console.log("PUT /user/:id - body keys:", Object.keys(req.body || {}));
      console.log("PUT /user/:id - file:", !!req.file, req.file ? { filename: (req.file as any).filename } : null);

      // จัดการไฟล์ใหม่ (ถ้ามี) และลบไฟล์เก่าใน /uploads ถ้าเป็นไฟล์ภายในระบบ
      let profileFilename = original.profile; // เก็บค่าปัจจุบัน
      if (req.file) {
        // multer เก็บ filename ใน req.file.filename ตาม config ของคุณ
        const newFilename = (req.file as any).filename;
        profileFilename = `/uploads/${newFilename}`;

        // ลบไฟล์เก่า ถ้า original.profile เป็น /uploads/<file>
        try {
          if (original.profile && typeof original.profile === "string" && original.profile.startsWith("/uploads/")) {
            const oldFilename = original.profile.replace(/^\/uploads\//, "");
            fileUpload.deleteFile(oldFilename);
          }
        } catch (e) {
          console.warn("Could not delete old profile file:", e);
        }
      }

      // password handling: ถ้ามี password ใหม่และไม่ว่าง ให้ hash
      let hashedPassword = original.password;
      if (typeof password === "string" && password.trim() !== "") {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      // อัปเดตข้อมูลในฐานข้อมูล
      const sql = "UPDATE users SET username=?, email=?, password=?, profile=? WHERE uid=?";
      await conn.query(sql, [
        username || original.username,
        email || original.email,
        hashedPassword,
        profileFilename,
        id,
      ]);

      // ดึงข้อมูลใหม่กลับมาและคืนค่าให้ client
      const [newRows] = await conn.query("SELECT uid, username, email, profile FROM users WHERE uid = ?", [id]);
      const updatedUser = (newRows as any[])[0];

      return res.status(200).json({ message: "User updated successfully", user: updatedUser });
    } catch (err) {
      console.error("PUT /user/:id error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);



// DELETE a user
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await conn.query(
      "SELECT profile FROM `users` WHERE uid = ?",
      [id]
    );
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
