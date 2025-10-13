import 'dotenv/config';
import express from "express";
import router from "./routes/index";
import { pingMongo } from "./repository/mongoRepository";
import { runPostgresProcessor } from "./services/mqttProcessor";

const app = express();
const port = process.env.PORT || 5004;

app.use(express.json());

app.use(router);

// Fallback health endpoints (direto no app)
app.get('/health', (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.get('/health/mongo', async (_req, res) => {
  try {
    const result = await pingMongo();
    if (result.ok) return res.status(200).json({ ok: true, mongo: result.serverInfo ?? true });
    return res.status(500).json({ ok: false });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  runPostgresProcessor();
});
