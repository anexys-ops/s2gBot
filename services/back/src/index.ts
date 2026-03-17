import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

const items: { id: string; label: string }[] = [
  { id: "1", label: "Élément A" },
  { id: "2", label: "Élément B" },
];

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "back" });
});

app.get("/items", (_req, res) => {
  res.json(items);
});

app.post("/items", (req, res) => {
  const { label } = req.body ?? {};
  if (!label || typeof label !== "string") {
    return res.status(400).json({ error: "label requis" });
  }
  const id = String(items.length + 1);
  items.push({ id, label });
  res.status(201).json({ id, label });
});

app.listen(PORT, () => {
  console.log(`Back listening on http://localhost:${PORT}`);
});
