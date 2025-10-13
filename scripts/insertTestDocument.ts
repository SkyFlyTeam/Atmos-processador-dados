import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error('Variável de ambiente MONGO_URI não definida.');
    }

    const collectionName = process.env.MONGO_COLLECTION || 'datas';

    const documento = {
        UUID: '123456',
        unixtime: Math.trunc(Date.now() / 1000),
        aaa: 12.34,
        aa: 56.78,
    };

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
    }
}

main().catch((error) => {
    console.error('[INSERT TEST DOC ERRO]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
