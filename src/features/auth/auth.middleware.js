const { AppError } = require('../../shared/errors/app-error');
const { ERROR_CODES } = require('../../shared/errors/error-codes');
const { verifyAccessToken } = require('../../shared/utils/tokens');
const { UserModel } = require('../users/user.model');

async function authenticateAccessToken(req, res, next) {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new AppError({
        code: ERROR_CODES.INVALID_ACCESS_TOKEN,
        message: 'Access token is required',
        statusCode: 401,
      });
    }

    const token = authorizationHeader.replace('Bearer ', '');
    const payload = verifyAccessToken(token);

    if (payload.type !== 'access') {
      throw new AppError({
        code: ERROR_CODES.INVALID_ACCESS_TOKEN,
        message: 'Access token is invalid',
        statusCode: 401,
      });
    }

    const user = await UserModel.findById(payload.sub);

    if (!user) {
      throw new AppError({
        code: ERROR_CODES.INVALID_ACCESS_TOKEN,
        message: 'Access token is invalid',
        statusCode: 401,
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError({
        code: ERROR_CODES.USER_SUSPENDED,
        message: 'User account is suspended',
        statusCode: 403,
      });
    }

    req.authUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticateAccessToken,
};
