import express from "express";
import type { Server } from "node:http";
import router from "./routes/index.ts";
import { connectMongoDB, disconnectMongoDB } from "./config/mongo.ts";
import { startMongoWatcher, stopMongoWatcher } from "./services/mongoWatcher.ts";
import { syncMongoToPostgres } from "./services/mongoToPostgresSync.ts";

const app = express();
const port = process.env.PORT || 5004;

app.use(express.json());

app.use(router);

const startServer = async (): Promise<void> => {
  try {
    await connectMongoDB();
    await startMongoWatcher();

    const initialSummary = await syncMongoToPostgres();
    if (initialSummary.totalDocuments > 0 || initialSummary.removedDocuments > 0) {
      console.log(
        `[MongoSync] Processamento inicial: ${initialSummary.processedDocuments}/${initialSummary.totalDocuments} documentos, ` +
          `${initialSummary.removedDocuments} removidos.`,
      );
      if (initialSummary.skippedDocuments.length > 0) {
        console.log(
          `[MongoSync] Documentos ignorados na sincronização inicial: ${initialSummary.skippedDocuments.length}.`,
        );
      }
      if (initialSummary.errors.length > 0) {
        console.warn('[MongoSync] Erros na sincronização inicial:', initialSummary.errors);
      }
    }

    const server: Server = app.listen(port, () => {
      console.log(`Servidor rodando em http://localhost:${port}`);
    });

    const shutdown = async (): Promise<void> => {
      console.log("Iniciando processo de desligamento do servidor...");
      await stopMongoWatcher();
      await disconnectMongoDB();
      server.close(() => {
        console.log("Servidor encerrado.");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Não foi possível iniciar o servidor devido a falha na conexão com o MongoDB Atlas.", error);
    process.exit(1);
  }
};

void startServer();
