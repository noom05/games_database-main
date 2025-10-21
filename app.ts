// app.ts (เฉพาะส่วนที่เปลี่ยน)
import express from "express";
import cors from "cors";
import path from "path";
import bodyParser from "body-parser";
import { jwtAuthen } from "./auth/jwtauth";

const app = express();

// 1) Body parser ก่อนจะใช้ route / middleware อื่นๆ
app.use(bodyParser.json());
app.use(bodyParser.text());

// 2) Serve views / static ก่อน jwt middleware
app.use(express.static(path.join(__dirname, "views")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// 3) CORS
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 4) ลง jwtAuthen และระบุ path ที่ยกเว้นให้ครอบคลุม /uploads
app.use(
  jwtAuthen.unless({
    path: [
      "/user/login",
      "/user/register",
      "/testtoken",
      "/games/types",
      "/uploads",               
      // ยกเว้น root uploads
      { url: /^\/uploads\/.*/, methods: ["GET"] }, // ยกเว้นไฟล์ภายใน uploads
      { url: /^\/games(\/.*)?$/, methods: ["GET"] } // ยกเว้น GET /games and subpaths
    ],
  })
);

// 5) แยก error-handler สำหรับ UnauthorizedError
app.use((err: any, _req: any, res: any, next: any) => {
  if (err && err.name === "UnauthorizedError") {
    return res.status(err.status || 401).json({ message: err.message || "Unauthorized" });
  }
  next(err);
});

// 6) Routes (ลงหลัง middleware)
import { router as index } from "./controller/index";
import { router as user } from "./controller/user";
import { router as games } from "./controller/games";
import { router as discountRouter } from './controller/discount';

app.use("/", index);
app.use("/user", user);
app.use("/games", games);
app.use('/discount', discountRouter);

export { app };
