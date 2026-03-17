import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 3003;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "auth" });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email et password requis" });
  }
  res.json({
    token: "demo-token-" + Math.random().toString(36).slice(2),
    user: { email },
  });
});

app.listen(PORT, () => {
  console.log(`Auth listening on http://localhost:${PORT}`);
});
