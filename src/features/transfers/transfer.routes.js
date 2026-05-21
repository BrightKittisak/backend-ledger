const express = require('express');

const { authenticateAccessToken } = require('../auth/auth.middleware');
const { validateRequest } = require('../../shared/middleware/validate-request');
const { moneyRateLimit } = require('../../shared/middleware/money-rate-limit');
const { createTransferController } = require('./transfer.controller');
const { transferBodySchema, transferHeadersSchema } = require('./transfer.schemas');

const transferRouter = express.Router();

transferRouter.use(authenticateAccessToken);

transferRouter.post(
  '/',
  moneyRateLimit,
  validateRequest({
    body: transferBodySchema,
    headers: transferHeadersSchema,
  }),
  createTransferController,
);

module.exports = {
  transferRouter,
};
