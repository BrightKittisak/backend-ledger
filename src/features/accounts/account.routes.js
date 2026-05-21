const express = require('express');

const { authenticateAccessToken } = require('../auth/auth.middleware');
const {
  attachOwnedAccountByPublicId,
} = require('../transactions/transaction.account-middleware');
const {
  getAccountTransactionHistoryController,
} = require('../transactions/transaction.controller');
const {
  transactionHistoryQuerySchema,
} = require('../transactions/transaction.schemas');
const { validateRequest } = require('../../shared/middleware/validate-request');
const {
  getAccountLookupController,
  getMyPrimaryAccountController,
  getOwnedAccountController,
} = require('./account.controller');
const {
  accountLookupQuerySchema,
  publicAccountIdParamsSchema,
} = require('./account.schemas');
const { lookupRateLimit } = require('./lookup.rate-limit');

const accountRouter = express.Router();

accountRouter.use(authenticateAccessToken);

accountRouter.get('/me', getMyPrimaryAccountController);
accountRouter.get(
  '/lookup',
  lookupRateLimit,
  validateRequest({ query: accountLookupQuerySchema }),
  getAccountLookupController,
);
accountRouter.get(
  '/:publicAccountId/transactions',
  validateRequest({
    params: publicAccountIdParamsSchema,
    query: transactionHistoryQuerySchema,
  }),
  attachOwnedAccountByPublicId,
  getAccountTransactionHistoryController,
);
accountRouter.get(
  '/:publicAccountId',
  validateRequest({ params: publicAccountIdParamsSchema }),
  getOwnedAccountController,
);

module.exports = {
  accountRouter,
};
