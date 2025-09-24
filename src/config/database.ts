import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config();

const {
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
} = process.env;

if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER || !DB_PASSWORD) {
  throw new Error('Variáveis de ambiente de banco de dados não configuradas corretamente.');
}

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: Number(DB_PORT),
  dialect: 'postgres',
  logging: false,
});

// Chamada opcional para verificar a conexão
export const connectDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com PostgreSQL estabelecida com sucesso.');
  } catch (error) {
    console.error('Falha ao conectar com o PostgreSQL:', error);
    process.exit(1);
  }
};
