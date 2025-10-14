import { ObjectId } from 'mongodb';
import type { WithId } from 'mongodb';
import { getMongoCollection } from '../config/mongo.ts';
import { sequelize } from '../config/database.ts';
import {
  findStationByUUID,
  fetchStationParameters,
  insertCapturedValue,
  type StationRecord,
  type StationParameterRecord,
} from '../repository/postgresSyncRepository.ts';

// Interface para representar um documento do MongoDB relacionado a uma estação atmosférica
interface MongoAtmosDocument extends WithId<Record<string, unknown>> {
  UUID?: string;
  unixtime?: number | string | Date;
}

// Interface para armazenar informações sobre documentos que foram ignorados durante a sincronização
interface SyncSkipInfo {
  id: string;
  reason: string;
  details?: string;
}

// Interface para armazenar informações sobre erros ocorridos durante a sincronização
interface SyncErrorInfo {
  id: string;
  error: string;
}

// Interface para representar o resumo da sincronização entre MongoDB e PostgreSQL
export interface SyncSummary {
  totalDocuments: number; // Total de documentos processados
  processedDocuments: number; // Total de documentos processados com sucesso
  insertedValues: number; // Total de valores inseridos no PostgreSQL
  skippedDocuments: SyncSkipInfo[]; // Documentos que foram ignorados durante a sincronização
  errors: SyncErrorInfo[]; // Erros encontrados durante o processo
  ignoredValues: number; // Quantidade de valores ignorados por não serem válidos
  removedDocuments: number; // Total de documentos removidos do MongoDB após sincronização
}

// Conjunto de campos a serem ignorados durante a sincronização
const FIELDS_TO_IGNORE = new Set(['_id', 'UUID', 'unixtime']);

// Cache para armazenar informações sobre as estações e seus parâmetros, evitando consultas repetidas
const stationCache = new Map<string, StationRecord | null>();
const parameterCache = new Map<number, Map<string, StationParameterRecord>>();

// Função para converter valores de "unixtime" em objetos Date
const parseUnixTime = (value: unknown): Date | null => {
  // Se já for uma instância de Date, retorna diretamente
  if (value instanceof Date) {
    return value;
  }

  // Se o valor não for número ou string, retorna null
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }

  // Tenta converter o valor para número
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  // Se o valor for um timestamp em segundos, converte para milissegundos
  const millis = parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
  const date = new Date(millis);
  // Verifica se a data é válida e retorna, caso contrário, retorna null
  return Number.isNaN(date.getTime()) ? null : date;
};

// Função para converter valores numéricos representados como string ou número
const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

// Função para obter a estação do MongoDB usando o UUID, armazenando em cache para evitar consultas repetidas
const getStation = async (uuid: string): Promise<StationRecord | null> => {
  // Verifica se a estação já está no cache, caso contrário, realiza a busca no banco
  if (stationCache.has(uuid)) {
    return stationCache.get(uuid) ?? null;
  }

  const found = await findStationByUUID(uuid);
  stationCache.set(uuid, found ?? null);
  return found ?? null;
};

// Função para obter os parâmetros da estação, armazenando em cache para evitar consultas repetidas
const getStationParameters = async (
  stationPk: number,
): Promise<Map<string, StationParameterRecord>> => {
  if (parameterCache.has(stationPk)) {
    return parameterCache.get(stationPk) ?? new Map<string, StationParameterRecord>();
  }

  const parameters = await fetchStationParameters(stationPk);
  parameterCache.set(stationPk, parameters);
  return parameters;
};

// Função para garantir que o ID do documento seja uma string válida
const ensureDocumentId = (id: ObjectId | undefined, fallback: string): string => {
  return id ? id.toString() : fallback;
};

// Função principal que sincroniza os dados do MongoDB para o PostgreSQL
export const syncMongoToPostgres = async (): Promise<SyncSummary> => {
  // Obtém a coleção do MongoDB
  const collection = await getMongoCollection();
  const cursor = collection.find<MongoAtmosDocument>({});

  // Inicializa o resumo da sincronização
  const summary: SyncSummary = {
    totalDocuments: 0,
    processedDocuments: 0,
    insertedValues: 0,
    skippedDocuments: [],
    errors: [],
    ignoredValues: 0,
    removedDocuments: 0,
  };

  const documentsToRemove: ObjectId[] = [];
  let missingIdForRemoval = 0;

  // Percorre todos os documentos no MongoDB
  for await (const document of cursor) {
    summary.totalDocuments += 1;
    const docId = ensureDocumentId(document._id, 'document-' + summary.totalDocuments);

    // Função para marcar documentos para remoção
    const markForRemoval = (): void => {
      if (document._id) {
        documentsToRemove.push(document._id);
      } else {
        missingIdForRemoval += 1;
      }
    };

    const uuid = typeof document.UUID === 'string' ? document.UUID.trim() : '';
    // Se o UUID estiver ausente, ignora o documento
    if (!uuid) {
      summary.skippedDocuments.push({
        id: docId,
        reason: 'UUID ausente',
      });
      markForRemoval();
      continue;
    }

    let station: StationRecord | null;
    try {
      station = await getStation(uuid);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar estação';
      summary.errors.push({
        id: docId,
        error: errorMessage,
      });
      continue;
    }

    // Se a estação não for encontrada, ignora o documento
    if (!station) {
      summary.skippedDocuments.push({
        id: docId,
        reason: 'Estação não encontrada',
        details: 'UUID ' + uuid,
      });
      markForRemoval();
      continue;
    }

    let parameters: Map<string, StationParameterRecord>;
    try {
      parameters = await getStationParameters(station.pk);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar parâmetros';
      summary.errors.push({
        id: docId,
        error: errorMessage,
      });
      continue;
    }

    // Se não houver parâmetros vinculados à estação, ignora o documento
    if (parameters.size === 0) {
      summary.skippedDocuments.push({
        id: docId,
        reason: 'Estação sem parâmetros vinculados',
        details: 'UUID ' + uuid,
      });
      markForRemoval();
      continue;
    }

    // Tenta converter o valor de 'unixtime' para um objeto Date válido
    const unixTimeDate = parseUnixTime(document.unixtime);
    if (!unixTimeDate) {
      summary.skippedDocuments.push({
        id: docId,
        reason: 'Unixtime inválido',
        details: 'Valor: ' + String(document.unixtime),
      });
      markForRemoval();
      continue;
    }

    // Filtra os campos do documento que não devem ser processados
    const entries = Object.entries(document).filter(function extractValidEntries(entry) {
      return !FIELDS_TO_IGNORE.has(entry[0]);
    });

    // Lista para armazenar os valores válidos a serem persistidos no PostgreSQL
    const valuesToPersist: Array<{ key: string; valor: number; parametrosPk: number }> = [];

    // Processa cada entrada do documento
    for (const entry of entries) {
      const key = entry[0];
      const rawValue = entry[1];

      const parameter = parameters.get(key);
      if (!parameter) {
        summary.ignoredValues += 1;
        continue;
      }

      const numericValue = parseNumericValue(rawValue);
      if (numericValue === null) {
        summary.ignoredValues += 1;
        continue;
      }

      valuesToPersist.push({
        key,
        valor: numericValue,
        parametrosPk: parameter.parametroPk,
      });
    }

    // Se não houver valores válidos para persistir, ignora o documento
    if (valuesToPersist.length === 0) {
      summary.skippedDocuments.push({
        id: docId,
        reason: 'Nenhum parâmetro válido encontrado',
        details: 'UUID ' + uuid,
      });
      markForRemoval();
      continue;
    }

    // Realiza a inserção dos valores capturados no PostgreSQL dentro de uma transação
    try {
      await sequelize.transaction(async (transaction) => {
        for (const valueInfo of valuesToPersist) {
          await insertCapturedValue(
            {
              unixtime: unixTimeDate,
              parametrosPk: valueInfo.parametrosPk,
              valor: valueInfo.valor,
              estacaoId: station.pk,
            },
            transaction,
          );
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao inserir valores';
      summary.errors.push({
        id: docId,
        error: errorMessage,
      });
      continue;
    }

    // Atualiza o resumo da sincronização
    summary.processedDocuments += 1;
    summary.insertedValues += valuesToPersist.length;
    markForRemoval();
  }

  // Remove os documentos processados do MongoDB
  if (documentsToRemove.length > 0) {
    const deleteResult = await collection.deleteMany({ _id: { $in: documentsToRemove } });
    summary.removedDocuments = deleteResult.deletedCount ?? 0;
  }

  // Registra qualquer erro relacionado à remoção de documentos sem _id
  if (missingIdForRemoval > 0) {
    summary.errors.push({
      id: 'unknown',
      error: `${missingIdForRemoval} documento(s) não puderam ser removidos por ausência de _id.`,
    });
  }

  // Retorna o resumo da sincronização
  return summary;
};
