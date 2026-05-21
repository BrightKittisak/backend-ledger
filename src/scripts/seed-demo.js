const { config } = require('../shared/config/env');
const { connectToDatabase } = require('../shared/db/connect-to-database');
const { logger } = require('../shared/logger/logger');
const { ensureSystemBootstrap } = require('../features/system/bootstrap.service');
const { seedDemoUsers } = require('../features/system/seed-demo.service');

async function seed() {
  await connectToDatabase(config.mongoUri);
  await ensureSystemBootstrap();

  const result = await seedDemoUsers();

  logger.info(result, 'Demo seed completed');
  process.exit(0);
}

seed().catch((error) => {
  logger.fatal({ err: error }, 'Demo seed failed');
  process.exit(1);
});
