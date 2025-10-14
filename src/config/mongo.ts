import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import type { Collection, Db } from 'mongodb';

// Carrega as variáveis de ambiente a partir de um arquivo .env
dotenv.config();

// Desestruturação das variáveis de ambiente MONGO_URI, MONGO_COLLECTION e MONGO_DB
const { MONGO_URI, MONGO_COLLECTION, MONGO_DB } = process.env;

// Verifica se a variável de ambiente MONGO_URI está definida, caso contrário, lança um erro
if (!MONGO_URI) {
  throw new Error('Variável de ambiente MONGO_URI não configurada.');
}

// Inicializa uma variável para armazenar a instância do MongoClient
let mongoClient: MongoClient | null = null;
// Remove espaços em branco no nome do banco de dados, se houver
const trimmedDbName = MONGO_DB?.trim();

// Função que retorna a instância do banco de dados com base no cliente MongoDB
const getDatabaseInstance = (client: MongoClient): Db => {
  // Se o nome do banco de dados foi definido, usa esse nome, caso contrário, usa o banco padrão
  return trimmedDbName ? client.db(trimmedDbName) : client.db();
};

// Função assíncrona para conectar ao MongoDB Atlas
export const connectMongoDB = async (): Promise<MongoClient> => {
  // Se a conexão já foi estabelecida, retorna o cliente existente
  if (mongoClient) {
    return mongoClient;
  }

  // Cria uma nova instância do MongoClient usando a URI configurada
  const client = new MongoClient(MONGO_URI);
  try {
    // Tenta se conectar ao MongoDB
    await client.connect();
    // Verifica se a conexão foi bem-sucedida fazendo um ping no banco de dados
    await getDatabaseInstance(client).command({ ping: 1 });
    // Se o nome do banco de dados foi definido, exibe uma mensagem com o nome do banco
    const databaseInfo = trimmedDbName ? `banco ${trimmedDbName}` : 'banco padrão definido na conexão';
    console.log(`Conexão com MongoDB Atlas estabelecida com sucesso (${databaseInfo}).`);
    // Armazena o cliente de conexão para evitar conexões duplicadas
    mongoClient = client;
    // Retorna o cliente conectado
    return mongoClient;
  } catch (error) {
    // Caso ocorra algum erro ao conectar, exibe uma mensagem de erro
    console.error('Falha ao conectar com o MongoDB Atlas:', error);
    // Fecha a conexão do cliente (se foi aberto) e ignora erros na tentativa de fechar
    await client.close().catch(() => undefined);
    // Lança o erro para que o código que chamou a função possa tratá-lo
    throw error;
  }
};

// Função assíncrona para obter uma coleção específica do MongoDB
export const getMongoCollection = async (
  collectionName = MONGO_COLLECTION, // Usa o nome da coleção configurado no ambiente ou o nome passado como argumento
): Promise<Collection> => {
  // Se o nome da coleção não foi informado, lança um erro
  if (!collectionName) {
    throw new Error('Nome da coleção do MongoDB não informado.');
  }

  // Obtém a instância do cliente conectado ao MongoDB
  const client = await connectMongoDB();
  // Retorna a coleção especificada dentro do banco de dados
  return getDatabaseInstance(client).collection(collectionName);
};

// Função assíncrona para desconectar do MongoDB
export const disconnectMongoDB = async (): Promise<void> => {
  // Se a conexão não foi estabelecida, não faz nada
  if (!mongoClient) {
    return;
  }

  // Fecha a conexão com o MongoDB
  await mongoClient.close();
  // Após fechar a conexão, define o cliente como nulo
  mongoClient = null;
};
