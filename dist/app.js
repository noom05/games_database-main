"use strict";
import path from "path";
import { fileURLToPath } from "url";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;

const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const index_1 = require("./controller/index");
const user_1 = require("./controller/user");
const admin_1 = require("./controller/admin");
const body_parser_1 = __importDefault(require("body-parser"));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express_1.default(); // ✅ ประกาศตัวแปร app ก่อน
exports.app = app;

app.use(cors_1.default({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(body_parser_1.default.text());
app.use(body_parser_1.default.json());
app.use("/", index_1.router);
app.use("/user", user_1.router);
app.use("/admin", admin_1.router);
app.use("/uploads", express_1.default.static("uploads"));

// ✅ เสิร์ฟไฟล์ static จาก public
app.use(express_1.default.static(path.join(__dirname, "public")));

// ✅ เส้นทางสำหรับ test_update
app.get("/test_update", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "test_update.html"));
});
