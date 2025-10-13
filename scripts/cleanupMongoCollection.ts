import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error('Variável de ambiente MONGO_URI não definida.');
    }

    const collectionName = process.env.MONGO_COLLECTION || 'datas';
    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        const db = client.db('Atmos');
        const collection = db.collection(collectionName);

        const { deletedCount } = await collection.deleteMany({});
        console.log(`[CLEANUP] ${deletedCount} documento(s) removido(s) da coleção ${collectionName}.`);
    } finally {
        await client.close();
    }
}

main().catch((error) => {
    console.error('[CLEANUP ERRO]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
