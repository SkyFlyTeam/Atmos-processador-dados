import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import type { Collection } from 'mongodb';

dotenv.config();

const { MONGO_URI, MONGO_COLLECTION } = process.env;

if (!MONGO_URI) {
  throw new Error('Variável de ambiente MONGO_URI não configurada.');
}

let mongoClient: MongoClient | null = null;

export const connectMongoDB = async (): Promise<MongoClient> => {
  if (mongoClient) {
    return mongoClient;
  }

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    await client.db().command({ ping: 1 });
    console.log('Conexão com MongoDB Atlas estabelecida com sucesso.');
    mongoClient = client;
    return mongoClient;
  } catch (error) {
    console.error('Falha ao conectar com o MongoDB Atlas:', error);
    await client.close().catch(() => undefined);
    throw error;
  }
};

export const getMongoCollection = async (
  collectionName = MONGO_COLLECTION,
): Promise<Collection> => {
  if (!collectionName) {
    throw new Error('Nome da coleção do MongoDB não informado.');
  }

  const client = await connectMongoDB();
  return client.db().collection(collectionName);
};

export const disconnectMongoDB = async (): Promise<void> => {
  if (!mongoClient) {
    return;
  }

  await mongoClient.close();
  mongoClient = null;
};
