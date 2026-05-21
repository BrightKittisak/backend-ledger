const { ZodError } = require('zod');

const { AppError } = require('../errors/app-error');
const { ERROR_CODES } = require('../errors/error-codes');
const { logger } = require('../logger/logger');

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError({
      code: ERROR_CODES.VALIDATION_ERROR,
      details: error.flatten(),
      message: 'Request validation failed',
      statusCode: 422,
    });
  }

  return new AppError({
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: 'An unexpected error occurred',
    statusCode: 500,
  });
}

function errorHandler(error, req, res, _next) {
  const normalizedError = normalizeError(error);

  logger.error(
    {
      code: normalizedError.code,
      details: normalizedError.details,
      err: error,
      requestId: req.requestId,
    },
    normalizedError.message,
  );

  res.status(normalizedError.statusCode).json({
    success: false,
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
      details: normalizedError.details,
    },
    requestId: req.requestId,
  });
}

module.exports = {
  errorHandler,
};
