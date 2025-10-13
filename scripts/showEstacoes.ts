import 'dotenv/config';
import sequelize from '../src/config/connections';
import { QueryTypes } from 'sequelize';

async function main() {
    const rows = await sequelize.query<Record<string, unknown>>(
        'SELECT * FROM estacoes LIMIT 5',
        { type: QueryTypes.SELECT }
    );

    console.log(rows);
    await sequelize.close();
}

main().catch((error) => {
    console.error('[ESTACOES ERRO]', error);
    process.exitCode = 1;
});
