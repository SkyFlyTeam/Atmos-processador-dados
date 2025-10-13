import 'dotenv/config';
import { MongoClient } from 'mongodb';
import sequelize from '../src/config/connections';
import { QueryTypes } from 'sequelize';

async function main() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error('Variável de ambiente MONGO_URI não definida.');
    }

    const collectionName = process.env.MONGO_COLLECTION || 'datas';

    const estacoes = await sequelize.query<{
        pk: number;
        uuid: string;
    }>(
        'SELECT pk, uuid FROM estacoes ORDER BY pk ASC',
        { type: QueryTypes.SELECT }
    ) as Array<{ pk: number; uuid: string }>;

    if (estacoes.length === 0) {
        throw new Error('Nenhuma estação encontrada na tabela estacoes. Cadastre uma antes do teste.');
    }

    let estacaoSelecionada: { pk: number; uuid: string } | null = null;
    let parametrosDaEstacao: Array<{ json_id: string }> = [];

    for (const estacao of estacoes) {
        const parametros = await sequelize.query<{
            json_id: string | null;
        }>(
            `SELECT tp.json_id
             FROM estacao_tipo_parametro etp
             INNER JOIN tipo_parametro tp ON tp.pk = etp.tipo_parametro_pk
             WHERE etp.estacao_est_pk = :estacaoPk`,
            {
                type: QueryTypes.SELECT,
                replacements: { estacaoPk: estacao.pk },
            }
        ) as Array<{ json_id: string | null }>;

        const jsonIdsValidos = parametros.filter((param) => Boolean(param.json_id)) as Array<{ json_id: string }>;

        if (jsonIdsValidos.length > 0) {
            estacaoSelecionada = estacao;
            parametrosDaEstacao = jsonIdsValidos;
            break;
        }
    }

    if (!estacaoSelecionada) {
        throw new Error('Nenhuma estação com parâmetros cadastrados foi encontrada.');
    }

    const documento: Record<string, unknown> = {
        UUID: estacaoSelecionada.uuid,
        unixtime: Math.trunc(Date.now() / 1000),
    };

    for (const parametro of parametrosDaEstacao) {
        documento[parametro.json_id] = Math.random() * 100;
    }

    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        const db = client.db('Atmos');
        const collection = db.collection(collectionName);
        const resultado = await collection.insertOne(documento);
        console.log('Documento inserido com sucesso na coleção', collectionName);
        console.log('ID inserido:', resultado.insertedId.toString());
        console.log('Payload:', JSON.stringify(documento, null, 2));
    } finally {
        await client.close();
        await sequelize.close();
    }
}

main().catch((error) => {
    console.error('[SEED ERRO]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});

