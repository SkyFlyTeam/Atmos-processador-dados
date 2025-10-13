import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

async function main() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error('Variável de ambiente MONGO_URI não definida.');
    }

    const collectionName = process.env.MONGO_COLLECTION || 'datas';
    const targetId = process.argv[2];
    if (!targetId) {
        throw new Error('Informe o ObjectId como primeiro argumento.');
    }

    if (!ObjectId.isValid(targetId)) {
        throw new Error('ObjectId inválido informado.');
    }

    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        const db = client.db('Atmos');
        const collection = db.collection(collectionName);

        const doc = await collection.findOne({ _id: new ObjectId(targetId) });

        if (!doc) {
            console.log('Documento não encontrado.');
        } else {
            console.log('Documento encontrado:', JSON.stringify(doc, null, 2));
        }
    } finally {
        await client.close();
    }
}

main().catch((error) => {
    console.error('[FIND DOC ERRO]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
