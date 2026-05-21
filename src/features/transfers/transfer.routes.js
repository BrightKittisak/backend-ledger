const express = require('express');

const { authenticateAccessToken } = require('../auth/auth.middleware');
const { validateRequest } = require('../../shared/middleware/validate-request');
const { createTransferController } = require('./transfer.controller');
const { transferRateLimit } = require('./transfer.rate-limit');
const { transferBodySchema, transferHeadersSchema } = require('./transfer.schemas');

const transferRouter = express.Router();

transferRouter.use(authenticateAccessToken);

transferRouter.post(
  '/',
  transferRateLimit,
  validateRequest({
    body: transferBodySchema,
    headers: transferHeadersSchema,
  }),
  createTransferController,
);

module.exports = {
  transferRouter,
};
