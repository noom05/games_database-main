import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { router as user } from "./controller/user";
import { router as games } from "./controller/games";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use("/user", user);
app.use("/games", games);

// ✅ เสิร์ฟ Angular frontend
app.use(express.static(path.join(__dirname, "dist/frontend")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/frontend/index.html"));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
