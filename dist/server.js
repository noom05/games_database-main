"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const user_1 = require("./controller/user");
const games_1 = require("./controller/games");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
app.use(express_1.default.json());
app.use("/user", user_1.router);
app.use("/games", games_1.router);
// ✅ เสิร์ฟ Angular frontend
app.use(express_1.default.static(path_1.default.join(__dirname, "dist/frontend")));
app.get("*", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "dist/frontend/index.html"));
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
