import { MongoClient } from 'mongodb';
import { ObjectId } from 'mongodb';

// URL de conexão com MongoDB
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017"; // Use a URL correta
const dbName = 'Atmos'; // Nome do banco de dados no MongoDB
const collectionName = process.env.MONGO_COLLECTION || 'datas';

// Função para excluir dados da coleção configurada no MongoDB
export async function deleteFromMongo(mongoId: string) {
    const client = new MongoClient(mongoUri);

    try {
        // Valida o ID antes de tentar excluir
        if (!ObjectId.isValid(mongoId)) {
            console.error(`[MONGO ERRO] ID inválido: ${mongoId}`);
            return;
        }

        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        const result = await collection.deleteOne({ _id: new ObjectId(mongoId) });

        if (result.deletedCount > 0) {
            console.log(`[MONGO OK] Documento deletado: ${mongoId}`);
        } else {
            console.log(`[MONGO ERRO] Documento não encontrado para deletar: ${mongoId}`);
        }
    } catch (err) {
        console.error('[MONGO ERRO] Erro ao deletar do MongoDB:', err);
    } finally {
        await client.close();
    }
}

// Função simples de healthcheck do MongoDB (ping)
export async function pingMongo(): Promise<{ ok: boolean; serverInfo?: any }> {
    const client = new MongoClient(mongoUri);
    try {
        await client.connect();
        const adminDb = client.db('admin');
        const result = await adminDb.command({ ping: 1 });
        let serverInfo: any = undefined;
        try {
            serverInfo = await adminDb.command({ serverStatus: 1 });
        } catch {}
        return { ok: Boolean((result as any).ok), serverInfo };
    } finally {
        await client.close();
    }
}
