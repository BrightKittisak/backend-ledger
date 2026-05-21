const { config } = require("./src/shared/config/env");
const { createApp } = require("./src/app");
const { connectToDatabase } = require("./src/shared/db/connect-to-database");
const { logger } = require("./src/shared/logger/logger");
const { assertBootstrapReady } = require("./src/features/system/bootstrap.service");

async function startServer() {
  await connectToDatabase(config.mongoUri);
  await assertBootstrapReady();

  const app = createApp();

  app.listen(config.port, () => {
    logger.info({ port: config.port }, "HTTP server started");
  });
}

startServer().catch((error) => {
  logger.fatal({ err: error }, "Unable to start server");
  process.exit(1);
});
