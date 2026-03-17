import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 3002;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "calcul" });
});

app.post("/sum", (req, res) => {
  const { a, b } = req.body ?? {};
  const na = Number(a);
  const nb = Number(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) {
    return res.status(400).json({ error: "a et b doivent être des nombres" });
  }
  res.json({ result: na + nb });
});

app.listen(PORT, () => {
  console.log(`Calcul listening on http://localhost:${PORT}`);
});
