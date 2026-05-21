const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const swaggerUi = require('swagger-ui-express');

const openApiSpec = require('../docs/openapi.v1.json');
const { accountRouter } = require('./features/accounts/account.routes');
const { authRouter } = require('./features/auth/auth.routes');
const { healthRouter, readinessRouter } = require('./features/health/health.routes');
const { config } = require('./shared/config/env');
const { errorHandler } = require('./shared/middleware/error-handler');
const { notFoundHandler } = require('./shared/middleware/not-found-handler');
const { requestContextMiddleware } = require('./shared/middleware/request-context');

function createCorsOptions() {
  const allowedOrigins = new Set(config.corsOrigins);

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS'));
    },
  };
}

function createApp() {
  const app = express();

  app.use(requestContextMiddleware);
  app.use(cors(createCorsOptions()));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/health', healthRouter);
  app.use('/ready', readinessRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/accounts', accountRouter);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
