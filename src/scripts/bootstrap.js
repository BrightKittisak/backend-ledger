const { config } = require('../shared/config/env');
const { connectToDatabase } = require('../shared/db/connect-to-database');
const { logger } = require('../shared/logger/logger');
const { ensureSystemBootstrap } = require('../features/system/bootstrap.service');

async function bootstrap() {
  await connectToDatabase(config.mongoUri);

  const result = await ensureSystemBootstrap();

  logger.info(
    {
      created: result.created,
      systemUserEmail: result.user.email,
    },
    'System bootstrap completed',
  );

  process.exit(0);
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'System bootstrap failed');
  process.exit(1);
});
