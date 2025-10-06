import express from "express";
import cors from "cors";
import { router as index } from "./controller/index";
import { router as user} from "./controller/user";
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

app.use(jwtAuthen, (err: any, req: any, res: any, next: any) => {
  if (err.name === "UnauthorizedError") {
    res.status(err.status).send({ message: err.message });
    return;
  }
  next();
});

// Test Token
app.use("/testtoken", (req, res) => {
    const payload: any = { username: "siriwat" }; 
    const jwttoken = generateToken(payload, secret);
  res.status(200).json({
    token: jwttoken,
  });
});

app.use(bodyParser.text());
app.use(bodyParser.json());
app.use("/", index);
app.use("/user", user);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
