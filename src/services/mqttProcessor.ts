import type { Documento } from '../interfaces/documento';
import { connectToMqtt, MQTT_SUBSCRIBE_TOPIC } from '../config/mqtt';
import { deleteFromMongo } from '../repository/mongoRepository';
import sequelize, { ValorCapturado } from '../config/connections';
import { QueryTypes } from 'sequelize';

// Utilitário para extrair mensagem de erro de forma segura
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

type ValorCapturadoPayload = {
    unixtime: Date;
    Parametros_pk: number;
    valor: number;
    estacao_id: number;
};

const estacaoCache = new Map<string, number>();
const parametroCache = new Map<number, Map<string, number>>();

async function findEstacaoPk(uuid: string): Promise<number | null> {
    if (!uuid) return null;

    const cached = estacaoCache.get(uuid);
    if (cached !== undefined) {
        return cached >= 0 ? cached : null;
    }

    try {
        const registros = await sequelize.query<{ pk: number }>(
            'SELECT pk FROM estacoes WHERE uuid = :uuid LIMIT 1',
            {
                type: QueryTypes.SELECT,
                replacements: { uuid },
            }
        ) as Array<{ pk: number }>;

        if (registros.length === 0) {
            estacaoCache.set(uuid, -1);
            return null;
        }

        const pk = registros[0].pk;
        estacaoCache.set(uuid, pk);
        return pk;
    } catch (error) {
        console.error(`[PG ERRO] Falha ao consultar estação para UUID ${uuid}: ${getErrorMessage(error)}`);
        return null;
    }
}

async function loadParametrosPermitidos(estacaoPk: number): Promise<Map<string, number>> {
    const cached = parametroCache.get(estacaoPk);
    if (cached) {
        return cached;
    }

    try {
        const registros = await sequelize.query<{ pk: number; json_id: string | null }>(
            `SELECT tp.pk, tp.json_id
             FROM parametro etp
             INNER JOIN tipo_parametro tp ON tp.pk = etp.tipo_parametro_pk
             WHERE etp.estacao_est_pk = :estacaoPk`,
            {
                type: QueryTypes.SELECT,
                replacements: { estacaoPk },
            }
        ) as Array<{ pk: number; json_id: string | null }>;

        const mapa = new Map<string, number>();
        for (const registro of registros) {
            if (registro.json_id) {
                mapa.set(registro.json_id, registro.pk);
            }
        }

        parametroCache.set(estacaoPk, mapa);
        return mapa;
    } catch (error) {
        console.error(`[PG ERRO] Falha ao consultar parâmetros permitidos para estação ${estacaoPk}: ${getErrorMessage(error)}`);
        return new Map();
    }
}

function normalizarMongoId(rawId: Documento['_id']): string | null {
    if (typeof rawId === 'string') return rawId;
    if (rawId && typeof rawId === 'object' && '$oid' in rawId) {
        const oid = (rawId as { $oid?: unknown }).$oid;
        return typeof oid === 'string' ? oid : null;
    }
    return null;
}

function montarValoresParaSalvar(
    documento: Documento,
    parametrosPermitidos: Map<string, number>,
    estacaoPk: number
): ValorCapturadoPayload[] {
    const valores: ValorCapturadoPayload[] = [];
    const unixtime = Number(documento.unixtime);

    if (!Number.isFinite(unixtime)) {
        throw new Error('Unixtime inválido');
    }

    const unixtimeDate = new Date(unixtime * 1000);
    if (Number.isNaN(unixtimeDate.getTime())) {
        throw new Error('Unixtime inválido');
    }

    const camposIgnorados = new Set(['_id', 'UUID', 'unixtime', 'estacao', 'parametro']);

    for (const [chave, bruto] of Object.entries(documento)) {
        if (camposIgnorados.has(chave)) continue;

        const parametroPk = parametrosPermitidos.get(chave);
        if (!parametroPk) {
            console.warn(`[PROCESSADOR] Parâmetro ${chave} ignorado para UUID ${documento.UUID}: não cadastrado.`);
            continue;
        }

        const valorNumerico = Number(bruto);
        if (!Number.isFinite(valorNumerico)) {
            console.warn(`[PROCESSADOR] Valor inválido para parâmetro ${chave} da estação ${documento.UUID}: ${bruto}`);
            continue;
        }

        valores.push({
            unixtime: unixtimeDate,
            Parametros_pk: parametroPk,
            valor: valorNumerico,
            estacao_id: estacaoPk,
        });
    }

    return valores;
}

async function salvarValoresNoPostgres(valores: ValorCapturadoPayload[]) {
    await sequelize.transaction(async (transaction) => {
        await ValorCapturado.bulkCreate(valores, { transaction });
    });
}

export function runPostgresProcessor() {
    const client = connectToMqtt();

    client.on('connect', () => {
        client.subscribe(MQTT_SUBSCRIBE_TOPIC, { qos: 1 });
        console.log(`[PROCESSADOR] Conectado e Assinando tópico: ${MQTT_SUBSCRIBE_TOPIC}`);
    });

    client.on('message', async (topic, message) => {
        try {
            const documento: Documento = JSON.parse(message.toString());
            console.log(`[PROCESSADOR] Dados recebidos para o sensor: ${documento.UUID}`);

            if (!documento.UUID) {
                throw new Error('UUID ausente no documento recebido.');
            }

            if (documento.unixtime == null) {
                throw new Error('Unixtime ausente no documento recebido.');
            }

            const estacaoPk = await findEstacaoPk(documento.UUID);

            if (!estacaoPk) {
                console.warn(`[PROCESSADOR] Estação não cadastrada para UUID ${documento.UUID}. Documento será ignorado.`);
                return;
            }

            const parametrosPermitidos = await loadParametrosPermitidos(estacaoPk);

            if (parametrosPermitidos.size === 0) {
                console.warn(`[PROCESSADOR] Estação ${documento.UUID} não possui parâmetros cadastrados. Documento ignorado.`);
                return;
            }

            const valoresParaSalvar = montarValoresParaSalvar(documento, parametrosPermitidos, estacaoPk);

            if (valoresParaSalvar.length === 0) {
                console.warn(`[PROCESSADOR] Nenhum parâmetro válido encontrado para UUID ${documento.UUID}. Documento ignorado.`);
                return;
            }

            await salvarValoresNoPostgres(valoresParaSalvar);
            console.log(`[PG OK] ${valoresParaSalvar.length} valor(es) inserido(s) para UUID ${documento.UUID}.`);

            const mongoId = normalizarMongoId(documento._id);
            if (mongoId) {
                await deleteFromMongo(mongoId);
            } else {
                console.warn('[PROCESSADOR] ID do MongoDB inválido ou ausente. Nenhuma exclusão realizada.');
            }
        } catch (error) {
            console.error(`[PROCESSADOR ERRO] Erro ao processar mensagem: ${getErrorMessage(error)}`);
        }
    });
}
