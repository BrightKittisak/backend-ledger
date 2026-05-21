const { AppError } = require('../errors/app-error');
const { ERROR_CODES } = require('../errors/error-codes');

function parsePart(schema, payload) {
  if (!schema) {
    return payload;
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new AppError({
      code: ERROR_CODES.VALIDATION_ERROR,
      details: result.error.flatten(),
      message: 'Request validation failed',
      statusCode: 422,
    });
  }

  return result.data;
}

function validateRequest({ body, headers, params, query }) {
  return function validateRequestMiddleware(req, res, next) {
    try {
      req.validated = {
        body: parsePart(body, req.body),
        headers: parsePart(headers, req.headers),
        params: parsePart(params, req.params),
        query: parsePart(query, req.query),
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  validateRequest,
};
