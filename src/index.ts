import express from "express";
import router from "./routes/index.ts";
import { connectMongoDB } from "./config/mongo.ts";

const app = express();
const port = process.env.PORT || 5004;

app.use(express.json());

app.use(router);

const startServer = async (): Promise<void> => {
  try {
    await connectMongoDB();
    app.listen(port, () => {
      console.log(`Servidor rodando em http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Não foi possível iniciar o servidor devido a falha na conexão com o MongoDB Atlas.", error);
    process.exit(1);
  }
};

void startServer();
