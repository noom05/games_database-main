import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export function verifyToken(req: any, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: Missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, "my-top-super-impossibel"); // ✅ ต้องใช้ secret เดียวกับตอน generateToken
    req.user = decoded; // ✅ เก็บ payload ลงใน req.user
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
}