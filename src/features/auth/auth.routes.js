const express = require('express');

const { validateRequest } = require('../../shared/middleware/validate-request');
const { authenticateAccessToken } = require('./auth.middleware');
const {
  changePasswordController,
  getCurrentAuthStateController,
  loginController,
  logoutController,
  refreshController,
  registerController,
} = require('./auth.controller');
const { authRateLimit } = require('./auth.rate-limit');
const {
  changePasswordBodySchema,
  loginBodySchema,
  refreshHeadersSchema,
  registerBodySchema,
} = require('./auth.schemas');

const authRouter = express.Router();

authRouter.post('/register', authRateLimit, validateRequest({ body: registerBodySchema }), registerController);
authRouter.post('/login', authRateLimit, validateRequest({ body: loginBodySchema }), loginController);
authRouter.post('/refresh', authRateLimit, validateRequest({ headers: refreshHeadersSchema }), refreshController);
authRouter.post('/logout', validateRequest({ headers: refreshHeadersSchema }), logoutController);
authRouter.get('/me', authenticateAccessToken, getCurrentAuthStateController);
authRouter.patch(
  '/password',
  authenticateAccessToken,
  validateRequest({ body: changePasswordBodySchema }),
  changePasswordController,
);

module.exports = {
  authRouter,
};
