# Atmos – Processador de Dados (API)

API Node/Express que recebe leituras de estações e envia os valores para o backend principal.

Uma vez que esse dados são lidos do MongoDB, estes devem ser salvos no backend Postgres e depois deletado do MongoDB.

A estratégia aqui pensada refere-se a uma rotina em que criamos uma "escuta" para qualquer alteração no MongoDB, uma vez que isso ocorra, dispara a rotina de coleta desses dados, persistência no Postegres e deleta do MongoDB.

## Requisitos
- Node.js 18 ou superior (necessário para `fetch` nativo)
- npm
- Backend Atmos (principal) rodando em `http://localhost:5000` com:
  - `GET /tipo-parametro/` retornando lista com campos `pk` e `json_id`
  - `GET /estacao/` retornando lista com campos `pk` e `uuid`
  - `POST /valor-capturado/` recebendo `{ unixtime, Parametros_pk, valor, estacao_id }`

## Instalação
```bash
cd Atmos-processador-dados
npm install
```

## Execução
- Opcional: defina a porta via variável `PORT` (padrão: `5004`).
- Primeira vez: instale dependências
```bash
npm install
```
- Desenvolvimento (recomendado, reload automático):
```bash
npm run dev
```
- Desenvolvimento simples (sem reload):
```bash
npm start
```
- Produção (compilado para JS):
```bash
npm run build
npm run start:prod
```
Saída esperada:
```
Servidor rodando em http://localhost:5004
```

## Endpoints
- `POST /valores/`
  - Recebe um JSON no corpo do request com:
    - `unixtime`: número (Unix time)
    - `UUID`: string da estação
    - Parâmetros adicionais onde a chave corresponde a um `json_id` válido do backend (ex.: `temperatura`, `umidade`, ...). Para cada chave reconhecida, a API envia um `POST` ao backend em `/valor-capturado/`.
  - Respostas:
    - `200`: `{ "message": "Sucesso no registro dos parâmetros" }`
    - `400`: corpo vazio ou campos ausentes/estação não encontrada
    - `500`: falha ao contatar o backend principal

### JSON básico (corpo da requisição)
```json
{
  "unixtime": 1728423981,
  "UUID": "123456",
  "temperatura": 23.4,
  "umidade": 55.1,
  "pressao": 1013.2
}
```

### Payload de exemplo (POST – pronto para uso)
> Ajuste o `UUID` para um existente no seu backend em `/estacao/` e mantenha apenas chaves que existam como `json_id` em `/tipo-parametro/`.
```json
{
  "unixtime": 1728423981,
  "UUID": "123456",
  "temperatura": 23.4,
  "umidade": 55.1,
  "pressao": 1013.2
}
```

Comando (curl) usando o payload acima:
```bash
curl -i -X POST "http://localhost:5004/valores/" \
  -H "Content-Type: application/json" \
  -d '{
    "unixtime": 1728423981,
    "UUID": "123456",
    "temperatura": 23.4,
    "umidade": 55.1,
    "pressao": 1013.2
  }'
```

### Exemplo de requisição (curl – bash)
```bash
curl -i -X POST "http://localhost:5004/valores/" \
  -H "Content-Type: application/json" \
  -d '{
    "unixtime": 1728423981,
    "UUID": "123456",
    "temperatura": 23.4,
    "umidade": 55.1
  }'
```

### Exemplo de requisição (PowerShell)
```powershell
$body = @{ 
  unixtime = 1728423981
  UUID = "123456"
  temperatura = 23.4
  umidade = 55.1
  pressao = 1013.2
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5004/valores/" -Method Post -ContentType "application/json" -Body $body
```


## Dependências com o backend
Os repositórios usam por padrão `http://localhost:5000`:
- `src/repository/tipoParametroRepository.ts`
- `src/repository/estacaoRepository.ts`
- `src/repository/valorCapturadoRepository.ts`

Para alterar o host/porta, hoje é necessário editar esses arquivos (ou refatorar para ler de variáveis de ambiente).

## Observações e dicas
- Utilize POST para envio de dados (melhor prática e compatível com proxies/clients).
- Removemos o `--loader ts-node/esm` em favor do `tsx` no desenvolvimento, eliminando o ExperimentalWarning.
- Avisos do Node:
  - `ExperimentalWarning` do loader `ts-node/esm`: é esperado no modo atual de execução.
  - `DeprecationWarning: fs.Stats`: vem de dependências; não impacta o funcionamento.
- Se a API retornar `500`, verifique se o backend em `http://localhost:5000` está acessível e respondendo conforme esperado.

## Configuração
- `PORT`: porta local da API (padrão `5004`).

---
Qualquer dúvida ou se quiser, posso adaptar a rota para `POST /valores` e/ou parametrizar as URLs do backend via variáveis de ambiente.

## Ordem de Teste (Passo a Passo)
1) Subir o backend (porta 5000)
- `cd Atmos-backend && npm install && npm start`
- Esperado: "Database synchronized" e "Server running on port 5000".

2) Criar uma estação
- POST `http://localhost:5000/estacao`
- Body (JSON):
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "nome": "Estação Centro",
  "descricao": "Estação de testes",
  "status": true,
  "lat": "-23.55",
  "long": "-46.63",
  "endereco": "Av. Teste, 123"
}
```
- Observação: o modelo atual não possui o campo `link`; se enviar, será ignorado.
- Anote o `pk` retornado (ex.: 1) e mantenha o `uuid` para usar no processador.

3) Criar tipos de parâmetro
- POST `http://localhost:5000/tipo-parametro`
- Exemplos de bodies:
```json
{ "json_id": "temperatura", "nome": "Temperatura", "unidade": "°C" }
```
```json
{ "json_id": "umidade", "nome": "Umidade", "unidade": "%" }
```
- Anote os `pk` retornados (ex.: 10, 11).

4) Relacionar estação × tipos de parâmetro
- POST `http://localhost:5000/estacao-tipo-parametro`
- Body (JSON):
```json
{ "estacao_est_pk": 1, "tipo_parametro_pk": [10, 11] }
```

5) Subir o processador (porta 5004)
- `cd Atmos-processador-dados && npm install && npm start`
- Esperado: "Servidor rodando em http://localhost:5004".

6) Enviar leituras para o processador
- POST `http://localhost:5004/valores/`
- Body (JSON):
```json
{
  "unixtime": 1728423981,
  "UUID": "123456",
  "temperatura": 23.4,
  "umidade": 55.1,
  "pressao": 1013.2
}
```
- Resposta esperada: `200` com `{ "message": "Sucesso no registro dos parâmetros" }`.

7) Verificar no backend
- Os valores devem ter sido persistidos via `POST /valor-capturado/` pelo processador.
- Você pode consultar listas/relatórios conforme rotas do backend.

Troubleshooting
- `fetch failed` no processador: backend em `http://localhost:5000` indisponível.
- `404 Registros não encontrados` em `/tipo-parametro` ou `/estacao`: cadastre os registros.
- GET com body não funciona no seu cliente: use Postman/Insomnia.

## Teste de Conexão com MongoDB
Este projeto expõe um healthcheck para validar a conexão com o MongoDB.

Pré‑requisitos
- MongoDB em execução localmente ou remoto.
- String de conexão disponível (padrão local: `mongodb://localhost:27017`).

Configuração
- Defina a variável de ambiente `MONGO_URI` (ou crie um arquivo `.env` na raiz de `Atmos-processador-dados`):
  - Exemplo local sem auth: `MONGO_URI=mongodb://localhost:27017`
  - Exemplo com auth: `MONGO_URI=mongodb://usuario:senha@localhost:27017/?authSource=admin`
- Reinicie a API após alterar `.env`.

Subir MongoDB rapidamente (opcional)
```bash
docker run -d --name atmos-mongo -p 27017:27017 mongo:6
```

Executar o teste
- Inicie a API do processador (`npm start`).
- Acesse o healthcheck do MongoDB:
  - Browser/Postman: `GET http://localhost:5004/health/mongo`
  - curl (bash): `curl -i http://localhost:5004/health/mongo`

Resultados esperados
- Sucesso: `200` com JSON `{"ok": true, ...}`
- Falha: `500` com `{"ok": false, "error": "..."}`