import express from "express";
import valoresRouter from "./routes/valores.ts";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use("/valores", valoresRouter);

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
