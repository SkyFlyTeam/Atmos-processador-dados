import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

const sequelize = new Sequelize({
  database: requiredEnv('DB_NAME'),
  username: requiredEnv('DB_USER'),
  password: requiredEnv('DB_PASSWORD'),
  host: requiredEnv('DB_HOST'),
  port: parseInt(requiredEnv('DB_PORT'), 10),
  dialect: 'postgres',
  logging: false,
});

// Modelo simplificado de ValorCapturado
const ValorCapturado = sequelize.define('ValorCapturado', {
  unixtime: { type: DataTypes.DATE, allowNull: false },
  Parametros_pk: { type: DataTypes.INTEGER, allowNull: false },
  valor: { type: DataTypes.DECIMAL(8, 4), allowNull: false },
  estacao_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'valor_capturado',
  timestamps: false,
});

export default sequelize;
export { ValorCapturado };
