import express from "express";
import cors from "cors";
import { router as index } from "./controller/index";
import { router as user} from "./controller/user";
import { router as admin} from "./controller/admin";
import bodyParser from "body-parser";
import path from "path";

export const app = express();

app.use(express.static(path.join(__dirname, "public")));
    
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(bodyParser.text());
app.use(bodyParser.json());
app.use("/", index);
app.use("/user", user);
app.use("/admin", admin);
app.use("/uploads", express.static("uploads"));