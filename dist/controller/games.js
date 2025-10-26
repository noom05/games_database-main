"use strict";
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
// get all games with categories + purchase status
exports.router.get("/", async (req, res) => {
    try {
        const userId = req.query.userId ? Number(req.query.userId) : null;
        // ✅ ดึงข้อมูลเกมทั้งหมด
        const [rows] = await dbconnect_1.conn.query(`
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
        let games = rows;
        // ✅ ถ้ามี userId ให้เช็กว่าเกมไหนเคยซื้อแล้ว
        if (userId) {
            const [purchasedRows] = await dbconnect_1.conn.query("SELECT game_id FROM transaction WHERE user_id = ? AND type = 'purchase'", [userId]);
            const purchasedIds = new Set(purchasedRows.map((p) => p.game_id));
            // ✅ เพิ่มฟิลด์ isPurchased ให้แต่ละเกม
            games = games.map((g) => ({
                ...g,
                isPurchased: purchasedIds.has(g.id),
            }));
        }
        else {
            // ถ้าไม่มี userId ก็ set false ทั้งหมด
            games = games.map((g) => ({ ...g, isPurchased: false }));
        }
        res.json(games);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Cannot read games data" });
    }
});
// get all game types
exports.router.get("/types", async (req, res) => {
    console.log("GET /games/types headers:", req.headers);
    try {
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM types");
        res.status(200).json(rows);
    }
    catch (err) {
        console.error("❌ GET /games/types error:", err.message);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});
// get game by id
exports.router.get("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: "Invalid game ID" });
        }
        // ดึงเกมพร้อมประเภท
        const [rows] = await dbconnect_1.conn.query(`
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
});
// get games by type
exports.router.get("/type/:typeId", async (req, res) => {
    try {
        const typeId = +req.params.typeId;
        const [rows] = await dbconnect_1.conn.query(`
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
});
// add new game
exports.router.post("/", fileMiddleware_1.fileUpload.diskLoader.single("file"), // multer middleware สำหรับรูปเกม
async (req, res) => {
    try {
        const { game_name, price, description, type_ids } = req.body;
        const imageFilename = req.file ? req.file.filename : null;
        const now = new Date();
        const year = now.getFullYear();
        const month = ('0' + (now.getMonth() + 1)).slice(-2);
        const day = ('0' + now.getDate()).slice(-2);
        const currentDate = `${year}-${month}-${day}`;
        // 1️⃣ เพิ่มเกมลงตาราง games
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
        const [result] = await dbconnect_1.conn.query(formattedSqlGame);
        const gameId = result.insertId;
        // 2️⃣ เพิ่มประเภทเกมลง game_type
        if (type_ids && Array.isArray(type_ids)) {
            const values = type_ids.map((typeId) => [gameId, typeId]);
            const sqlTypes = "INSERT INTO game_type (game_id, type_id) VALUES ?";
            await dbconnect_1.conn.query(sqlTypes, [values]);
        }
        // 3️⃣ ส่ง response
        res.status(201).json({
            message: "เพิ่มเกมสำเร็จ",
            game: {
                id: gameId,
                game_name,
                price,
                description,
                image: imageFilename,
            },
        });
    }
    catch (err) {
        console.error("POST /games error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// delete game by id
exports.router.delete("/:id", async (req, res) => {
    try {
        const id = +req.params.id;
        // 1️⃣ ดึงชื่อไฟล์จาก DB ก่อน
        const [rows] = await dbconnect_1.conn.query("SELECT image FROM games WHERE id = ?", [
            id,
        ]);
        const game = rows[0];
        if (!game) {
            return res.status(404).json({ message: "Game not found" });
        }
        // 2️⃣ ลบ record จาก DB
        const [result] = await dbconnect_1.conn.query("DELETE FROM games WHERE id = ?", [id]);
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
});
// edit game by id
exports.router.put("/:id", fileMiddleware_1.fileUpload.diskLoader.single("file"), // รองรับ upload รูปใหม่
async (req, res) => {
    try {
        const id = +req.params.id;
        const { game_name, price, description, release_date, type_ids } = req.body; // type_ids = array ของ type_id
        // 1️⃣ ดึงข้อมูลเกมเดิม
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM games WHERE id = ?", [id]);
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
        const [updateResult] = await dbconnect_1.conn.query(formattedSql);
        const info = updateResult;
        // 4️⃣ อัปเดตประเภทเกม (ลบของเก่าแล้วเพิ่มใหม่)
        if (type_ids && Array.isArray(type_ids)) {
            // ลบของเก่า
            await dbconnect_1.conn.query("DELETE FROM game_type WHERE game_id = ?", [id]);
            // เพิ่มใหม่
            const values = type_ids.map((typeId) => [id, typeId]);
            await dbconnect_1.conn.query("INSERT INTO game_type (game_id, type_id) VALUES ?", [
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
});
// 🔍 Search games by keyword (name or description)
exports.router.get("/search/:keyword", async (req, res) => {
    try {
        const keyword = req.params.keyword;
        // ใช้ LIKE เพื่อค้นหาในชื่อหรือคำอธิบาย
        const [rows] = await dbconnect_1.conn.query(`
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
      WHERE g.game_name LIKE ? OR g.description LIKE ?
      GROUP BY g.id
      `, [`%${keyword}%`, `%${keyword}%`]);
        res.json(rows);
    }
    catch (err) {
        console.error("GET /games/search/:keyword error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// POST /games/multiple-types
exports.router.post('/multiple-types', async (req, res) => {
    try {
        const { typeIds } = req.body; // [1,2,3]
        if (!typeIds || !Array.isArray(typeIds) || typeIds.length === 0) {
            return res.status(400).json({ error: "No typeIds provided" });
        }
        const placeholders = typeIds.map(() => '?').join(',');
        const [rows] = await dbconnect_1.conn.query(`
      SELECT g.id, g.game_name, g.price, g.image, g.description,
             g.release_date, g.total_sales, GROUP_CONCAT(t.type_name SEPARATOR ', ') AS categories
      FROM games g
      JOIN game_type gt ON g.id = gt.game_id
      JOIN types t ON gt.type_id = t.id
      WHERE t.id IN (${placeholders})
      GROUP BY g.id
    `, typeIds);
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// GET /games/:id/detail-with-rank
//แก้ใหม่
exports.router.get("/:id/detail-with-rank", async (req, res) => {
    try {
        const gameId = Number(req.params.id);
        if (isNaN(gameId))
            return res.status(400).json({ error: "Invalid game ID" });
        const connection = await dbconnect_1.conn.getConnection();
        // 1️⃣ ดึงเกมที่ต้องการ
        const [gameRows] = await connection.query(`
      SELECT g.id, g.game_name, g.price, g.image, g.description,
             g.release_date, g.total_sales,
             GROUP_CONCAT(t.type_name SEPARATOR ', ') AS categories
      FROM games g
      LEFT JOIN game_type gt ON g.id = gt.game_id
      LEFT JOIN types t ON gt.type_id = t.id
      WHERE g.id = ?
      GROUP BY g.id
      `, [gameId]);
        if (gameRows.length === 0) {
            connection.release();
            return res.status(404).json({ error: "Game not found" });
        }
        const game = gameRows[0];
        // 2️⃣ ดึง total_sales ทั้งหมดเรียงลดหลั่น
        const [allGames] = await connection.query("SELECT id, total_sales FROM games ORDER BY total_sales DESC, id ASC");
        // 3️⃣ คำนวณ dense rank
        let rank = 1;
        let prevSales = null;
        let currentRank = 1;
        for (let g of allGames) {
            if (prevSales !== null && g.total_sales < prevSales) {
                currentRank++;
            }
            if (g.id === gameId) {
                rank = currentRank;
                break;
            }
            prevSales = g.total_sales;
        }
        connection.release();
        // 4️⃣ ส่ง response
        res.json({
            game,
            rank
        });
    }
    catch (err) {
        console.error("GET /games/:id/detail-with-rank error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
