import 'dotenv/config';
import { MongoClient } from 'mongodb';

const documentos = [
    {
        UUID: 'PLUVIOMETRO-8',
        unixtime: 1760008695,
        plu: 1,
        umi: 62,
        tem: 23.25,
    },
    {
        UUID: 'SOLO-6',
        unixtime: 1760008695,
        hum: 74,
        ph: 7,
        tmp: 20.28,
    },
];

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

        const resultado = await collection.insertMany(documentos);
        console.log(`[INSERT] ${resultado.insertedCount} documentos inseridos na coleção ${collectionName}.`);
        for (const [index, id] of Object.entries(resultado.insertedIds)) {
            console.log(`  Documento ${Number(index) + 1}: ${id.toString()}`);
        }
    } finally {
        await client.close();
    }
}

main().catch((error) => {
    console.error('[INSERT ERRO]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
