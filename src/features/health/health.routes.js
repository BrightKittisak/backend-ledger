const express = require('express');

const { healthController, readinessController } = require('./health.controller');

const healthRouter = express.Router();
const readinessRouter = express.Router();

healthRouter.get('/', healthController);
readinessRouter.get('/', readinessController);

module.exports = {
  healthRouter,
  readinessRouter,
};
