import express from "express";
import router from "./routes/index.ts";

const app = express();
const port = process.env.PORT || 5004;

app.use(express.json());

app.use(router);

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
