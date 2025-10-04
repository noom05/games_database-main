"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileUpload = exports.router = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
exports.router = express_1.default.Router();
class FileMiddleware {
    constructor() {
        this.filename = "";
        this.diskLoader = (0, multer_1.default)({
            storage: multer_1.default.diskStorage({
                // Set the destination folder for the uploaded files
                destination: (_req, _file, cb) => {
                    cb(null, path_1.default.join(__dirname, "../uploads"));
                },
                // Set the unique filename for the uploaded file
                filename: (req, file, cb) => {
                    const uniqueSuffix = (0, uuid_1.v4)();
                    this.filename = uniqueSuffix + "." + file.originalname.split(".").pop();
                    cb(null, this.filename);
                },
            }),
            limits: {
                fileSize: 67108864, // 64 MByte
            },
        });
        const uploadsDir = path_1.default.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
    }
    deleteFile(filename) {
        if (!filename)
            return false;
        const filePath = path_1.default.join(__dirname, "../uploads", filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted file: ${filePath}`);
            return true;
        }
        console.warn(`⚠️ File not found: ${filePath}`);
        return false;
    }
}
exports.fileUpload = new FileMiddleware();
// Route to upload a file
exports.router.post("/", exports.fileUpload.diskLoader.single("file"), (req, res) => {
    res.json({ filename: exports.fileUpload.filename });
});
