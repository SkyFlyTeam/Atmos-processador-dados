import type { ChangeStream } from 'mongodb';
import { getMongoCollection } from '../config/mongo.ts';
import { syncMongoToPostgres } from './mongoToPostgresSync.ts';

// Variável para armazenar a instância do ChangeStream (fluxo de mudanças) do MongoDB
let changeStream: ChangeStream | null = null;
// Variável de controle para indicar se a sincronização está em andamento
let syncInProgress = false;
// Variável de controle para indicar se há uma sincronização pendente enquanto outra está em andamento
let pendingSync = false;

// Função que loga um resumo da sincronização entre MongoDB e PostgreSQL
const logSummary = (summary: Awaited<ReturnType<typeof syncMongoToPostgres>>): void => {
  // Verifica se houve documentos processados ou removidos e loga o resumo da operação
  if (summary.totalDocuments > 0 || summary.removedDocuments > 0) {
    const message = '[MongoSync] Processados ' +
      summary.processedDocuments + '/' + summary.totalDocuments + ', ' +
      summary.removedDocuments + ' documento(s) removido(s). Ignorados: ' + summary.ignoredValues + '.';
    console.log(message);
  }

  // Caso tenha ocorrido algum erro durante a sincronização, exibe um aviso no log
  if (summary.errors.length > 0) {
    console.warn('[MongoSync] Ocorreram erros durante a sincronização automática.', summary.errors);
  }
};

// Função que dispara a sincronização entre MongoDB e PostgreSQL
const triggerSync = async (): Promise<void> => {
  // Verifica se já existe uma sincronização em andamento
  if (syncInProgress) {
    // Caso haja uma sincronização em andamento, marca que há uma sincronização pendente
    pendingSync = true;
    return;
  }

  // Marca que a sincronização está em andamento
  syncInProgress = true;
  try {
    // Executa a função de sincronização e aguarda a resposta
    const summary = await syncMongoToPostgres();
    // Exibe o resumo da sincronização
    logSummary(summary);
  } catch (error) {
    // Caso ocorra um erro durante a sincronização, exibe uma mensagem de erro
    console.error('[MongoSync] Falha ao executar sincronização automática:', error);
  } finally {
    // Marca que a sincronização foi finalizada
    syncInProgress = false;
    // Caso haja uma sincronização pendente, chama a função de sincronização novamente
    if (pendingSync) {
      pendingSync = false;
      void triggerSync();
    }
  }
};

// Função para iniciar o "watcher" (observador) de alterações no MongoDB
export const startMongoWatcher = async (): Promise<void> => {
  // Verifica se já existe um ChangeStream ativo
  if (changeStream) {
    return;
  }

  // Obtém a coleção do MongoDB que será observada
  const collection = await getMongoCollection();
  // Cria uma instância de ChangeStream para observar inserções na coleção
  changeStream = collection.watch([{ $match: { operationType: 'insert' } }]);

  // Evento que é acionado quando uma alteração do tipo 'insert' é detectada
  changeStream.on('change', () => {
    console.log('[MongoSync] Detecção de novo documento no MongoDB. Iniciando sincronização.');
    // Dispara a sincronização assim que um novo documento é inserido
    void triggerSync();
  });

  // Evento que é acionado quando ocorre um erro no ChangeStream
  changeStream.on('error', async (error) => {
    console.error('[MongoSync] Erro no change stream do MongoDB:', error);
    // Caso ocorra um erro, tenta fechar o ChangeStream e reiniciar após 5 segundos
    await stopMongoWatcher();
    setTimeout(() => {
      void startMongoWatcher().catch((err) => {
        console.error('[MongoSync] Falha ao reiniciar watcher após erro:', err);
      });
    }, 5000);
  });

  // Evento que é acionado quando o ChangeStream é fechado
  changeStream.on('close', () => {
    changeStream = null;
    console.log('[MongoSync] Change stream encerrado.');
  });

  console.log('[MongoSync] Watcher de inserts no MongoDB iniciado.');
};

// Função para parar o "watcher" de alterações no MongoDB
export const stopMongoWatcher = async (): Promise<void> => {
  // Verifica se há um ChangeStream ativo
  if (changeStream) {
    // Fecha o ChangeStream e captura qualquer erro durante o fechamento
    await changeStream.close().catch((error) => {
      console.error('[MongoSync] Erro ao fechar change stream:', error);
    });
    // Define a variável changeStream como null
    changeStream = null;
  }
};
