import path from "path";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import fs from "fs";

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

class FileMiddleware {
  public filename = "";

  public readonly diskLoader = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
      },
      filename: (_req, file, cb) => {
        const ext = file.originalname.split(".").pop();
        const unique = uuidv4();
        this.filename = `${unique}.${ext}`;
        cb(null, this.filename);
      },
    }),
    limits: {
      fileSize: 64 * 1024 * 1024, // 64 MB
    },
  });

  public deleteFile(filename: string): boolean {
    if (!filename) return false;
    const filePath = path.join(__dirname, "..", "uploads", filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted file: ${filePath}`);
      return true;
    }
    console.warn(`⚠️ File not found: ${filePath}`);
    return false;
  }
}

export const fileUpload = new FileMiddleware();
export const tempDirectory = uploadsDir;
