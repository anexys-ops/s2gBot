import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BACK_URL = process.env.BACK_URL || "http://localhost:3001";
const CALCUL_URL = process.env.CALCUL_URL || "http://localhost:3002";
const AUTH_URL = process.env.AUTH_URL || "http://localhost:3003";

app.use(cors());

// Proxy avant express.json() pour que le corps des requêtes POST soit bien transmis aux services
app.use(
  "/api/back",
  createProxyMiddleware({
    target: BACK_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/back": "" },
  })
);
app.use(
  "/api/calcul",
  createProxyMiddleware({
    target: CALCUL_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/calcul": "" },
  })
);
app.use(
  "/api/auth",
  createProxyMiddleware({
    target: AUTH_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/auth": "" },
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

app.listen(PORT, () => {
  console.log(`API Gateway listening on http://localhost:${PORT}`);
});
