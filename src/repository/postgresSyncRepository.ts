import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/database.ts';

// Define a interface para os registros de estação, com campos 'pk' e 'uuid'
export interface StationRecord {
  pk: number;
  uuid: string;
}

// Define a interface para os registros de parâmetros da estação, com campos 'parametroPk', 'tipoParametroPk' e 'jsonId'
export interface StationParameterRecord {
  parametroPk: number;
  tipoParametroPk: number;
  jsonId: string;
  offset: number | string | null;
  fator: number | string | null;
}

// Define a interface para os dados de entrada de valores capturados, com campos 'unixtime', 'parametrosPk', 'valor' e 'estacaoId'
export interface CapturedValueInput {
  unixtime: Date;
  parametrosPk: number;
  valor: number;
  estacaoId: number;
}

// Função assíncrona que busca uma estação pelo seu UUID no banco de dados
export const findStationByUUID = async (uuid: string): Promise<StationRecord | null> => {
  // Executa uma consulta SQL para buscar a estação com o UUID fornecido e retorna a primeira estação encontrada ou null se não houver resultados
  const records = await sequelize.query<StationRecord>(
    'SELECT pk, uuid FROM estacoes WHERE uuid = :uuid LIMIT 1',
    {
      replacements: { uuid }, // Substitui :uuid pela variável uuid fornecida como argumento
      type: QueryTypes.SELECT, // Define o tipo da consulta como SELECT
    },
  );

  // Retorna o primeiro registro encontrado ou null caso não haja resultados
  return records[0] ?? null;
};

// Função assíncrona que busca os parâmetros de uma estação com base no seu ID
export const fetchStationParameters = async (
  stationPk: number,
): Promise<Map<string, StationParameterRecord>> => {
  // SQL para buscar os parâmetros da estação, unindo as tabelas 'parametro' e 'tipo_parametro' com base na chave estrangeira
  const sql = `
    SELECT
      p.pk AS "parametroPk",
      p.tipo_parametro_pk AS "tipoParametroPk",
      tp.json_id AS "jsonId",
      COALESCE(p.offset, tp.offset) AS "offset",
      COALESCE(p.fator, tp.fator) AS "fator"
    FROM parametro p
    INNER JOIN tipo_parametro tp ON tp.pk = p.tipo_parametro_pk
    WHERE p.estacao_est_pk = :stationPk
  `;

  // Executa a consulta SQL para buscar os parâmetros da estação com o ID fornecido
  const records = await sequelize.query<StationParameterRecord>(sql, {
    replacements: { stationPk }, // Substitui :stationPk pela variável stationPk fornecida como argumento
    type: QueryTypes.SELECT, // Define o tipo da consulta como SELECT
  });

  // Retorna um Map onde a chave é o 'jsonId' e o valor é o registro de StationParameterRecord
  return records.reduce((acc, record) => {
    if (record.jsonId) {
      acc.set(record.jsonId, record);
    }
    return acc;
  }, new Map<string, StationParameterRecord>());
};

// Função assíncrona que insere um novo valor capturado no banco de dados
export const insertCapturedValue = async (
  data: CapturedValueInput, // Dados de entrada para o valor capturado
  transaction?: Transaction, // Transação opcional, usada para garantir a atomicidade das operações
): Promise<void> => {
  // SQL para inserir os dados de valor capturado na tabela 'valor_capturado'
  const sql = 'INSERT INTO valor_capturado (unixtime, "Parametros_pk", valor, estacao_id)' +
    ' VALUES (:unixtime, :parametrosPk, :valor, :estacaoId)';

  // Executa a consulta SQL para inserir os dados fornecidos na tabela 'valor_capturado'
  await sequelize.query(sql, {
    replacements: {
      unixtime: data.unixtime,        // Substitui :unixtime pelos dados fornecidos
      parametrosPk: data.parametrosPk, // Substitui :parametrosPk pelos dados fornecidos
      valor: data.valor,               // Substitui :valor pelos dados fornecidos
      estacaoId: data.estacaoId,       // Substitui :estacaoId pelos dados fornecidos
    },
    type: QueryTypes.INSERT, // Define o tipo da consulta como INSERT
    transaction,             // Se fornecida, usa a transação para garantir a atomicidade
  });
};
