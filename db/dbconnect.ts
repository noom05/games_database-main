import mysql from "mysql2/promise";
import dotenv from 'dotenv';

dotenv.config(); // โหลดตัวแปรจากไฟล์ .env

export const conn = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,       // อ่านจากตัวแปร
  user: process.env.DB_USER,       // อ่านจากตัวแปร
  password: process.env.DB_PASSWORD, // อ่านจากตัวแปร
  database: process.env.DB_DATABASE, // อ่านจากตัวแปร
  port: Number(process.env.DB_PORT)  // อ่านจากตัวแปร
});