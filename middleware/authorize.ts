import { Request, Response, NextFunction } from "express";

// Middleware ตรวจสอบสิทธิ์ตาม role
export function authorizeRole(roles: string[]) {
  return (req: any, res: Response, next: NextFunction) => {
    // user info ถูกใส่ใน req.user จาก express-jwt
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Access denied" });
    }

    next();
  };
}