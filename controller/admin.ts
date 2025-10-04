import express from "express";
import { conn } from "../db/dbconnect";
import mysql from "mysql2";
import bcrypt from "bcrypt";
import { Admin } from "../model/admin";

export const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await conn.query("SELECT * FROM admin");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cannot read admin data" });
  }
});

router.post("/", async (req, res) => {
  try {
    const user: Admin = req.body;
    const hashedPassword = await bcrypt.hash(user.password, 10);

    const sql =
      "INSERT INTO `admin`(`username`,`email`,`password`,`profile`) VALUES (?,?,?,?)";
    const formattedSql = mysql.format(sql, [
      user.username,
      user.email,
      hashedPassword,
      user.profile,
    ]);

    const [result] = await conn.query(formattedSql); // async/await
    const info = result as mysql.ResultSetHeader;

    res
      .status(201)
      .json({ affected_row: info.affectedRows, last_idx: info.insertId });
  } catch (err) {
    console.error("POST /admin error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = +req.params.id;
    const [result] = await conn.query("DELETE FROM `admin` WHERE aid = ?", [
      id,
    ]);
    const info = result as mysql.ResultSetHeader;

    res.status(200).json({ affected_row: info.affectedRows });
  } catch (err) {
    console.error("DELETE /admin error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = +req.params.id;
    const admin: Partial<Admin> = req.body; // Partial = อนุญาต update field บางส่วน

    // ดึงข้อมูล user เดิม
    const [rows] = await conn.query("SELECT * FROM admin WHERE aid = ?", [id]);
    const result = rows as Admin[];

    if (result.length === 0) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const original = result[0];

    // ถ้า request มี password ใหม่ ให้ hash
    let hashedPassword = original.password;
    if (admin.password) {
      hashedPassword = await bcrypt.hash(admin.password, 10);
    }

    // รวมข้อมูลเดิมกับข้อมูลใหม่
    const update = {
      ...original,
      ...admin,
      password: hashedPassword,
    };

    const sql =
      "UPDATE admin SET username=?, email=?, password=?, profile=? WHERE aid=?";
    const formattedSql = mysql.format(sql, [
      update.username,
      update.email,
      update.password,
      update.profile,
      id,
    ]);

    const [updateResult] = await conn.query(formattedSql);
    const info = updateResult as mysql.ResultSetHeader;

    res.status(200).json({ affected_row: info.affectedRows });
  } catch (err) {
    console.error("PUT /admin/:id error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
