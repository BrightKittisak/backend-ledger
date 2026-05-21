const express = require('express');

const { authenticateAccessToken } = require('../auth/auth.middleware');
const { validateRequest } = require('../../shared/middleware/validate-request');
const { moneyRateLimit } = require('../../shared/middleware/money-rate-limit');
const { createDepositController } = require('./deposit.controller');
const { depositBodySchema, depositHeadersSchema } = require('./deposit.schemas');

const depositRouter = express.Router();

depositRouter.use(authenticateAccessToken);

depositRouter.post(
  '/',
  moneyRateLimit,
  validateRequest({
    body: depositBodySchema,
    headers: depositHeadersSchema,
  }),
  createDepositController,
);

module.exports = {
  depositRouter,
};
