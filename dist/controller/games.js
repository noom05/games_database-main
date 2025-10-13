"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const dbconnect_1 = require("../db/dbconnect");
const mysql2_1 = __importDefault(require("mysql2"));
const fileMiddleware_1 = require("../middleware/fileMiddleware");
exports.router = express_1.default.Router();
// get all games with their categories
exports.router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [rows] = yield dbconnect_1.conn.query(`
      SELECT 
        g.id,
        g.game_name,
        g.price,
        g.image,
        g.description,
        g.release_date,
        g.total_sales,
        GROUP_CONCAT(t.type_name SEPARATOR ', ') AS categories
      FROM games g
      LEFT JOIN game_type gt ON g.id = gt.game_id
      LEFT JOIN types t ON gt.type_id = t.id
      GROUP BY g.id
    `);
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Cannot read games data" });
    }
}));
// get all game types
exports.router.get("/types", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("GET /games/types headers:", req.headers);
    try {
        const [rows] = yield dbconnect_1.conn.query("SELECT * FROM types");
        res.status(200).json(rows);
    }
    catch (err) {
        console.error("❌ GET /games/types error:", err.message);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
}));
// get game by id
exports.router.get("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: "Invalid game ID" });
        }
        // ดึงเกมพร้อมประเภท
        const [rows] = yield dbconnect_1.conn.query(`
      SELECT 
        g.id,
        g.game_name,
        g.price,
        g.image,
        g.description,
        g.release_date,
        g.total_sales,
        GROUP_CONCAT(t.type_name SEPARATOR ', ') AS categories
      FROM games g
      LEFT JOIN game_type gt ON g.id = gt.game_id
      LEFT JOIN types t ON gt.type_id = t.id
      WHERE g.id = ?
      GROUP BY g.id
      `, [id]);
        const games = rows;
        if (games.length === 0) {
            return res.status(404).json({ error: "Game not found" });
        }
        const game = games[0];
        res.json(game);
    }
    catch (err) {
        console.error("GET /games/:id error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
// get games by type
exports.router.get("/type/:typeId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const typeId = +req.params.typeId;
        const [rows] = yield dbconnect_1.conn.query(`
      SELECT 
        g.id,
        g.game_name,
        g.price,
        g.image,
        g.description,
        g.release_date,
        g.total_sales,
        GROUP_CONCAT(t.type_name SEPARATOR ', ') AS categories
      FROM games g
      JOIN game_type gt ON g.id = gt.game_id
      JOIN types t ON gt.type_id = t.id
      WHERE t.id = ?
      GROUP BY g.id
      `, [typeId]);
        const games = rows;
        if (games.length === 0) {
            return res.status(404).json({ error: "No games found for this type" });
        }
        res.json(games);
    }
    catch (err) {
        console.error("GET /games/type/:typeId error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
// add new game
exports.router.post("/", fileMiddleware_1.fileUpload.diskLoader.single("file"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { game_name, price, description } = req.body;
        const imageFilename = req.file ? req.file.filename : null;
        let type_ids = [];
        try {
            type_ids = req.body.type_ids ? JSON.parse(req.body.type_ids) : [];
        }
        catch (e) {
            console.warn("⚠️ ไม่สามารถแปลง type_ids ได้:", req.body.type_ids);
        }
        const now = new Date();
        const currentDate = `${now.getFullYear()}-${("0" + (now.getMonth() + 1)).slice(-2)}-${("0" + now.getDate()).slice(-2)}`;
        const sqlGame = `
        INSERT INTO games (game_name, price, image, description, release_date, total_sales)
        VALUES (?, ?, ?, ?, ?, 0)
      `;
        const formattedSqlGame = mysql2_1.default.format(sqlGame, [
            game_name,
            price,
            imageFilename,
            description,
            currentDate
        ]);
        const [result] = yield dbconnect_1.conn.query(formattedSqlGame);
        const gameId = result.insertId;
        if (Array.isArray(type_ids) && type_ids.length > 0) {
            const values = type_ids.map((typeId) => [gameId, typeId]);
            const sqlTypes = "INSERT INTO game_type (game_id, type_id) VALUES ?";
            yield dbconnect_1.conn.query(sqlTypes, [values]);
        }
        res.status(201).json({
            message: "เพิ่มเกมสำเร็จ",
            game: {
                id: gameId,
                game_name,
                price,
                description,
                image: imageFilename,
                type_ids
            },
        });
    }
    catch (err) {
        console.error("❌ POST /games error:", err);
        res.status(500).json({ error: "เพิ่มเกมไม่สำเร็จ", detail: err.message || err });
    }
}));
// delete game by id
exports.router.delete("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = +req.params.id;
        // 1️⃣ ดึงชื่อไฟล์จาก DB ก่อน
        const [rows] = yield dbconnect_1.conn.query("SELECT image FROM games WHERE id = ?", [
            id,
        ]);
        const game = rows[0];
        if (!game) {
            return res.status(404).json({ message: "Game not found" });
        }
        // 2️⃣ ลบ record จาก DB
        const [result] = yield dbconnect_1.conn.query("DELETE FROM games WHERE id = ?", [id]);
        const info = result;
        // 3️⃣ ลบไฟล์จริง
        if (game.image) {
            fileMiddleware_1.fileUpload.deleteFile(game.image);
        }
        res
            .status(200)
            .json({ message: "Game deleted", affected_row: info.affectedRows });
    }
    catch (err) {
        console.error("DELETE /games/:id error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
// edit game by id
exports.router.put("/:id", fileMiddleware_1.fileUpload.diskLoader.single("file"), // รองรับ upload รูปใหม่
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = +req.params.id;
        const { game_name, price, description, release_date, type_ids } = req.body; // type_ids = array ของ type_id
        // 1️⃣ ดึงข้อมูลเกมเดิม
        const [rows] = yield dbconnect_1.conn.query("SELECT * FROM games WHERE id = ?", [id]);
        const result = rows;
        if (result.length === 0) {
            return res.status(404).json({ message: "Game not found" });
        }
        const original = result[0];
        // 2️⃣ ถ้ามีไฟล์ใหม่ อัปเดตชื่อไฟล์ใหม่และลบไฟล์เก่า
        let imageFilename = original.image;
        if (req.file) {
            if (original.image) {
                fileMiddleware_1.fileUpload.deleteFile(original.image);
            }
            imageFilename = req.file.filename;
        }
        // 3️⃣ อัปเดตข้อมูลเกม
        const sql = `
        UPDATE games
        SET game_name = ?, price = ?, description = ?, release_date = ?, image = ?
        WHERE id = ?
      `;
        const formattedSql = mysql2_1.default.format(sql, [
            game_name || original.game_name,
            price || original.price,
            description || original.description,
            release_date || original.release_date,
            imageFilename,
            id,
        ]);
        const [updateResult] = yield dbconnect_1.conn.query(formattedSql);
        const info = updateResult;
        // 4️⃣ อัปเดตประเภทเกม (ลบของเก่าแล้วเพิ่มใหม่)
        if (type_ids && Array.isArray(type_ids)) {
            // ลบของเก่า
            yield dbconnect_1.conn.query("DELETE FROM game_type WHERE game_id = ?", [id]);
            // เพิ่มใหม่
            const values = type_ids.map((typeId) => [id, typeId]);
            yield dbconnect_1.conn.query("INSERT INTO game_type (game_id, type_id) VALUES ?", [
                values,
            ]);
        }
        res.status(200).json({
            message: "Game updated",
            affected_row: info.affectedRows,
            game: {
                id,
                game_name: game_name || original.game_name,
                price: price || original.price,
                description: description || original.description,
                release_date: release_date || original.release_date,
                image: imageFilename,
                type_ids: type_ids || null,
            },
        });
    }
    catch (err) {
        console.error("PUT /games/:id error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
