const express = require('express');

const { authenticateAccessToken } = require('../auth/auth.middleware');
const { attachPrimaryAccount } = require('./transaction.viewer-middleware');
const { validateRequest } = require('../../shared/middleware/validate-request');
const { getTransactionDetailController } = require('./transaction.controller');
const { publicTransactionIdParamsSchema } = require('./transaction.schemas');

const transactionRouter = express.Router();

transactionRouter.use(authenticateAccessToken);
transactionRouter.use(attachPrimaryAccount);

transactionRouter.get(
  '/:publicTransactionId',
  validateRequest({ params: publicTransactionIdParamsSchema }),
  getTransactionDetailController,
);

module.exports = {
  transactionRouter,
};
