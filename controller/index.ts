import express from "express";
import path from "path";

export const router = express.Router();

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/register.html"));
});
