# Atmos Processador de Dados

Processador que busca leituras registradas no MongoDB Atlas, valida se existe estrutura correspondente no PostgreSQL (servico Atmos-backend) e persiste os valores na tabela "valor_capturado". Depois da reconciliacao os documentos, tenham sido aceitos ou rejeitados, sao removidos da colecao no Mongo.

## Requisitos
- Node.js 18+ (desenvolvido com Node 22)
- Dependencias instaladas com `npm install`
- Banco PostgreSQL acessivel (o mesmo do Atmos-backend)
- Cluster MongoDB Atlas contendo a colecao com as leituras

## Variaveis de ambiente
Crie um arquivo `.env` com o seguinte conteudo:

```env
# MongoDB Atlas
MONGO_URI=mongodb+srv://<usuario>:<senha>@<cluster>.mongodb.net/?retryWrites=true&w=majority&appName=<app>
MONGO_DB=Atmos
MONGO_COLLECTION=datas_teste

# PostgreSQL
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=admin123456
```

Campos obrigatorios:
- `MONGO_URI`: string de conexao gerada pelo Atlas.
- `MONGO_DB`: banco logico onde a colecao esta armazenada.
- `MONGO_COLLECTION`: colecao com documentos no formato { UUID, unixtime, chave: valor }.
- Credenciais `DB_*`: mesmas usadas pelo Atmos-backend.

### Preparando os dados de teste no Atlas
Caso os dados originais estejam em outra colecao (ex.: `datas`), replique-os para a colecao utilizada pelo processador (`datas_teste`). Uma maneira pratica usando o Atlas Data Explorer:

1. Abra o cluster no Atlas e acesse **Collections**.
2. Selecione o banco de origem (ex.: `Atmos`) e a colecao `datas`.
3. Clique em **Collection Actions → Duplicate Collection**.
4. Nomeie a nova colecao como `datas_teste` (no mesmo banco) e confirme. O Atlas criara uma copia completa.

Alternativa via `mongosh` (reutilize a mesma URI que voce configurou em `MONGO_URI`, incluindo `appName`/parametros extras):

```bash
mongosh "mongodb+srv://admin:fogueiramagica@atmos.fath8uu.mongodb.net/?retryWrites=true&w=majority&appName=Atmos" \
  --eval 'db.datas_teste.aggregate([{ $match: {} }, { $out: "datas_teste_1" }])'
```

Se o comando retornar `querySrv ENOTFOUND`, confira se o host do cluster (`<cluster>.mongodb.net`) esta correto — por exemplo, `atmos.fath8uu.mongodb.net` — exatamente como aparece na string de conexao fornecida pelo Atlas.

Certifique-se de que a nova colecao esta apontada em `MONGO_COLLECTION` antes de iniciar o processador.

#### Passo a passo via `mongosh`
1. Abra o shell conectado ao cluster (mesma URI usada em `MONGO_URI`):
   ```bash
   mongosh "mongodb+srv://<usuario>:<senha>@<cluster>.mongodb.net/Atmos?retryWrites=true&w=majority&appName=<app>"
   ```
2. No prompt do shell selecione o banco:
   ```javascript
   use Atmos
   ```
3. Copie a colecao original para `datas_teste`:
   ```javascript
   db.datas.aggregate([{ $match: {} }, { $out: "datas_teste" }])
   ```
4. Digite `exit` para sair.

## Principais arquivos

| Caminho | Descricao |
| ------- | --------- |
| `src/index.ts` | Bootstrap do servidor Express. Conecta ao Mongo, executa sincronizacao inicial, liga o watcher de inserts e registra as rotas. Tambem trata o encerramento gracioso (SIGINT/SIGTERM). |
| `src/config/mongo.ts` | Helpers do MongoDB Atlas (`connectMongoDB`, `getMongoCollection`, `disconnectMongoDB`). Usa `MONGO_DB` para abrir o banco correto. |
| `src/config/database.ts` | Configuracao do Sequelize apontando para o PostgreSQL. |
| `src/services/mongoToPostgresSync.ts` | Servico principal de sincronizacao. Valida UUID/parametros, grava em `valor_capturado`, gera resumo e remove os documentos tratados. |
| `src/services/mongoWatcher.ts` | Change stream watcher. Ao detectar novos inserts dispara a sincronizacao, com controle para evitar execucoes concorrentes e retry basico. |
| `src/repository/postgresSyncRepository.ts` | Consultas SQL usadas para buscar estacao, parametros vinculados e inserir valores capturados. |
| `src/routes/valores.ts` | Rotas HTTP (GET /valores legado e POST /valores/sync para acionar a sincronizacao manualmente). |

## Execucao
1. Instale dependencias: `npm install`
2. Ajuste o `.env`
3. Inicie o servidor: `npm start`

Logs esperados no boot:
- Conexao com o MongoDB Atlas com identificacao do banco ativo
- Resultado da sincronizacao inicial (processados, removidos, ignorados)
- Confirmacao de que o watcher esta ativo
- URL do servidor Express (porta 5004 por padrao)

Para encerrar use `Ctrl+C`. O servidor fecha o watcher, encerra a conexao com o Mongo e termina o processo.

## Sincronizacao automatica
- Um novo documento inserido na colecao dispara o watcher.
- A rotina executa: coleta -> validacao -> persistencia no Postgres -> remocao do documento no Mongo.
- Insercoes em sequencia sao enfileiradas por `pendingSync`, evitando sincronizacoes paralelas.

## Sincronizacao manual
Dispare a rotina manualmente:

```bash
curl -X POST http://localhost:5004/valores/sync
```

A resposta contem o resumo (`processedDocuments`, `removedDocuments`, `skippedDocuments`, `errors`, etc.).

### Testando pelo Postman
1. Crie uma nova requisicao `POST` com a URL `http://localhost:5004/valores/sync`.
2. Nenhum corpo e necessario (leave body vazio).
3. Envie a requisicao; o JSON de resposta trara o mesmo resumo exibido no terminal.
4. Se preferir salvar, adicione a requisicao em uma collection para repetir o teste apos novas leituras no Mongo.

Para validar os dados persistidos no Atmos-backend:
- Certifique-se de que o servidor Atmos-backend esta rodando (default `npm start` na pasta do outro projeto, porta `5000`).
- No Postman ou navegador, acesse `http://localhost:5000/valor-capturado` (GET). A resposta deve listar os registros gravados pelo processador.

## Desenvolvimento
- Tipagem com TypeScript (`npx tsc --noEmit` para checagem).
- Servidor rodando com `ts-node/esm` (sem hot reload).
- Projeto usa modulos ES e importa as extensoes `.ts` explicitamente.

## Troubleshooting
- **Resumo zerado**: confira `MONGO_DB`/`MONGO_COLLECTION` e se ha documentos com `UUID` e `unixtime` validos.
- **Estacao sem parametros**: cadastre os parametros no Atmos-backend (tabelas `parametro` e `tipo_parametro`).
- **Erro de conexao com Postgres**: valide as credenciais `DB_*` e se o banco esta acessivel.
