import 'dotenv/config';
import sequelize from '../src/config/connections';
import { QueryTypes } from 'sequelize';

type StationConfig = {
    uuid: string;
    nome: string;
    descricao: string;
    endereco: string;
    lat: string;
    long: string;
    parametros: Array<{ jsonId: string; nome: string; unidade?: string }>;
};

const stations: StationConfig[] = [
    {
        uuid: 'PLUVIOMETRO-8',
        nome: 'Estação Pluviométrica 8',
        descricao: 'Estação pluviométrica de teste',
        endereco: 'Endereço Pluviômetro 8',
        lat: '-23.55',
        long: '-46.63',
        parametros: [
            { jsonId: 'plu', nome: 'Pluviometria', unidade: 'mm' },
            { jsonId: 'umi', nome: 'Umidade do Ar', unidade: '%' },
            { jsonId: 'tem', nome: 'Temperatura do Ar', unidade: '°C' },
        ],
    },
    {
        uuid: 'SOLO-6',
        nome: 'Estação Solo 6',
        descricao: 'Sensores de solo de teste',
        endereco: 'Endereço Solo 6',
        lat: '-23.55',
        long: '-46.64',
        parametros: [
            { jsonId: 'hum', nome: 'Umidade do Solo', unidade: '%' },
            { jsonId: 'ph', nome: 'pH do Solo', unidade: 'pH' },
            { jsonId: 'tmp', nome: 'Temperatura do Solo', unidade: '°C' },
        ],
    },
];

async function ensureTipoParametro(jsonId: string, nome: string, unidade?: string): Promise<number> {
    const existing = await sequelize.query<{ pk: number }>(
        'SELECT pk FROM tipo_parametro WHERE json_id = :jsonId LIMIT 1',
        {
            type: QueryTypes.SELECT,
            replacements: { jsonId },
        }
    ) as Array<{ pk: number }>;

    if (existing.length > 0) {
        return existing[0].pk;
    }

    const resultado = await sequelize.query<{ pk: number }>(
        `INSERT INTO tipo_parametro (json_id, nome, unidade)
         VALUES (:jsonId, :nome, :unidade)
         RETURNING pk`,
        {
            type: QueryTypes.SELECT,
            replacements: { jsonId, nome, unidade: unidade ?? null },
        }
    ) as Array<{ pk: number }>;

    if (resultado.length === 0) {
        throw new Error(`Falha ao inserir tipo_parametro para ${jsonId}`);
    }

    return resultado[0].pk;
}

async function ensureEstacao(config: StationConfig): Promise<number> {
    const existing = await sequelize.query<{ pk: number }>(
        'SELECT pk FROM estacoes WHERE uuid = :uuid LIMIT 1',
        {
            type: QueryTypes.SELECT,
            replacements: { uuid: config.uuid },
        }
    ) as Array<{ pk: number }>;

    if (existing.length > 0) {
        return existing[0].pk;
    }

    const resultado = await sequelize.query<{ pk: number }>(
        `INSERT INTO estacoes (uuid, nome, descricao, status, lat, long, endereco, imagem)
         VALUES (:uuid, :nome, :descricao, true, :lat, :long, :endereco, NULL)
         RETURNING pk`,
        {
            type: QueryTypes.SELECT,
            replacements: {
                uuid: config.uuid,
                nome: config.nome,
                descricao: config.descricao,
                lat: config.lat,
                long: config.long,
                endereco: config.endereco,
            },
        }
    ) as Array<{ pk: number }>;

    if (resultado.length === 0) {
        throw new Error(`Falha ao inserir estação ${config.uuid}`);
    }

    return resultado[0].pk;
}

async function ensureParametro(estacaoPk: number, tipoParametroPk: number) {
    const existing = await sequelize.query<{ pk: number }>(
        'SELECT pk FROM parametro WHERE estacao_est_pk = :estacaoPk AND tipo_parametro_pk = :tipoParametroPk LIMIT 1',
        {
            type: QueryTypes.SELECT,
            replacements: { estacaoPk, tipoParametroPk },
        }
    ) as Array<{ pk: number }>;

    if (existing.length > 0) {
        return existing[0].pk;
    }

    await sequelize.query(
        `INSERT INTO parametro (estacao_est_pk, tipo_parametro_pk)
         VALUES (:estacaoPk, :tipoParametroPk)`,
        {
            type: QueryTypes.INSERT,
            replacements: { estacaoPk, tipoParametroPk },
        }
    );
}

async function main() {
    for (const station of stations) {
        const estacaoPk = await ensureEstacao(station);
        console.log(`[SETUP] Estação ${station.uuid} -> pk ${estacaoPk}`);

        for (const parametro of station.parametros) {
            const tipoParametroPk = await ensureTipoParametro(parametro.jsonId, parametro.nome, parametro.unidade);
            console.log(`  [SETUP] Tipo de parâmetro ${parametro.jsonId} -> pk ${tipoParametroPk}`);
            await ensureParametro(estacaoPk, tipoParametroPk);
        }
    }

    await sequelize.close();
    console.log('[SETUP] Configuração concluída.');
}

main().catch(async (error) => {
    console.error('[SETUP ERRO]', error instanceof Error ? error.message : error);
    await sequelize.close();
    process.exitCode = 1;
});
