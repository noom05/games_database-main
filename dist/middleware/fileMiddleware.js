"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tempDirectory = exports.fileUpload = void 0;
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const uploadsDir = path_1.default.join(__dirname, '..', 'uploads');
if (!fs_1.default.existsSync(uploadsDir))
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
class FileMiddleware {
    constructor() {
        this.filename = "";
        this.diskLoader = (0, multer_1.default)({
            storage: multer_1.default.diskStorage({
                destination: (_req, _file, cb) => {
                    cb(null, uploadsDir);
                },
                filename: (_req, file, cb) => {
                    const ext = file.originalname.split(".").pop();
                    const unique = (0, uuid_1.v4)();
                    this.filename = `${unique}.${ext}`;
                    cb(null, this.filename);
                },
            }),
            limits: {
                fileSize: 64 * 1024 * 1024, // 64 MB
            },
        });
    }
    deleteFile(filename) {
        if (!filename)
            return false;
        const filePath = path_1.default.join(__dirname, "..", "uploads", filename);
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
            console.log(`🗑️ Deleted file: ${filePath}`);
            return true;
        }
        console.warn(`⚠️ File not found: ${filePath}`);
        return false;
    }
}
exports.fileUpload = new FileMiddleware();
exports.tempDirectory = uploadsDir;
