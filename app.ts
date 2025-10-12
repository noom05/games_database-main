import express from "express";
import cors from "cors";
import { router as index } from "./controller/index";
import { router as user } from "./controller/user";
import { router as games } from "./controller/games";

import bodyParser from "body-parser";
import path from "path";
import { generateToken, jwtAuthen, secret } from "./auth/jwtauth";

export const app = express();


app.use(express.static(path.join(__dirname, "views")));

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/assets", express.static(path.join(__dirname, "assets")));
// เราจะใช้ .unless() เพื่อบอกว่า Middleware นี้จะไม่ทำงานกับ path ที่ระบุไว้
app.use(
  jwtAuthen.unless({
    path: [
      "/user/login",      // ยกเว้นหน้า Login
      "/user/register",   // ยกเว้นหน้า Register
      "/testtoken",       // ยกเว้นหน้า Test Token
      "/games/types", // ยกเว้นหน้า /games/types
      { url: /^\/games(\/.*)?$/, methods: ['GET'] } 
    ],
  }),
  (err: any, req: any, res: any, next: any) => {
    if (err.name === "UnauthorizedError") {
      res.status(err.status).send({ message: err.message });
      return;
    }
    next();
  }
);

app.use("/testtoken", (req, res) => {
  const payload: any = { username: "siriwat" };
  const jwttoken = generateToken(payload, secret);
  res.status(200).json({ token: jwttoken });
});

app.use(bodyParser.json());
app.use(bodyParser.text()); // ถ้าจำเป็นต้องใช้ text
app.use("/", index);
app.use("/user", user);
app.use("/games", games);
