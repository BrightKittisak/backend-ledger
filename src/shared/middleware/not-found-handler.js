const { AppError } = require('../errors/app-error');
const { ERROR_CODES } = require('../errors/error-codes');

function notFoundHandler(req, res, next) {
  next(
    new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Route not found',
      statusCode: 404,
    }),
  );
}

module.exports = {
  notFoundHandler,
};
