const express = require('express');

const { authenticateAccessToken } = require('../auth/auth.middleware');
const { validateRequest } = require('../../shared/middleware/validate-request');
const { moneyRateLimit } = require('../../shared/middleware/money-rate-limit');
const { createWithdrawalController } = require('./withdrawal.controller');
const { withdrawalBodySchema, withdrawalHeadersSchema } = require('./withdrawal.schemas');

const withdrawalRouter = express.Router();

withdrawalRouter.use(authenticateAccessToken);

withdrawalRouter.post(
  '/',
  moneyRateLimit,
  validateRequest({
    body: withdrawalBodySchema,
    headers: withdrawalHeadersSchema,
  }),
  createWithdrawalController,
);

module.exports = {
  withdrawalRouter,
};
