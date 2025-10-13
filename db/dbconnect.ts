import mysql from "mysql2/promise";
import dotenv from 'dotenv';

// dotenv.config(); // โหลดตัวแปรจากไฟล์ .env

export const conn = mysql.createPool({
  connectionLimit: 10,
  host: "202.28.34.210",
  user: "66011212136",
  password: "66011212136",
  database: "db66011212136",
  port: 3309
  
});