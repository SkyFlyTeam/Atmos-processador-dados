import 'dotenv/config';
import sequelize from '../src/config/connections';
import { QueryTypes } from 'sequelize';

async function main() {
    const rows = await sequelize.query<Record<string, unknown>>(
        'SELECT * FROM tipo_parametro ORDER BY pk LIMIT 10',
        { type: QueryTypes.SELECT }
    );

    console.log(rows);
    await sequelize.close();
}

main().catch((error) => {
    console.error('[TIPO_PARAMETRO ERRO]', error);
    process.exitCode = 1;
});
