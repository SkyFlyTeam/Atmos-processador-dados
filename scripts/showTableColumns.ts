import 'dotenv/config';
import sequelize from '../src/config/connections';
import { QueryTypes } from 'sequelize';

async function main() {
    const tableName = process.argv[2];
    if (!tableName) {
        throw new Error('Informe o nome da tabela como primeiro argumento.');
    }

    const rows = await sequelize.query<Record<string, unknown>>(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :tableName ORDER BY ordinal_position",
        {
            type: QueryTypes.SELECT,
            replacements: { tableName },
        }
    );

    console.log(rows);
    await sequelize.close();
}

main().catch((error) => {
    console.error('[SHOW COLUMNS ERRO]', error);
    process.exitCode = 1;
});
