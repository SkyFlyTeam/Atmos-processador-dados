import 'dotenv/config';
import sequelize from '../src/config/connections';
import { QueryTypes } from 'sequelize';

async function main() {
    const tables = await sequelize.query<Record<string, unknown>>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
        { type: QueryTypes.SELECT }
    ) as Array<Record<string, unknown>>;

    console.log('Tabelas encontradas:', tables);
    await sequelize.close();
}

main().catch((error) => {
    console.error('[LIST TABLES ERRO]', error);
    process.exitCode = 1;
});
