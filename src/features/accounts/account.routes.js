const express = require('express');

const { authenticateAccessToken } = require('../auth/auth.middleware');
const { validateRequest } = require('../../shared/middleware/validate-request');
const {
  getMyPrimaryAccountController,
  getOwnedAccountController,
} = require('./account.controller');
const { publicAccountIdParamsSchema } = require('./account.schemas');

const accountRouter = express.Router();

accountRouter.use(authenticateAccessToken);

accountRouter.get('/me', getMyPrimaryAccountController);
accountRouter.get(
  '/:publicAccountId',
  validateRequest({ params: publicAccountIdParamsSchema }),
  getOwnedAccountController,
);

module.exports = {
  accountRouter,
};
