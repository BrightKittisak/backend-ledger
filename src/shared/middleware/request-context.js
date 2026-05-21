const crypto = require('crypto');

const pinoHttp = require('pino-http');

const { logger } = require('../logger/logger');

const httpLogger = pinoHttp({
  logger,
  customProps(req) {
    return {
      requestId: req.requestId,
    };
  },
  genReqId(req, res) {
    const requestId = req.headers["x-request-id"] || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    return requestId;
  },
  serializers: {
    req(request) {
      return {
        id: request.id,
        method: request.method,
        url: request.url,
      };
    },
    res(response) {
      return {
        statusCode: response.statusCode,
      };
    },
  },
});

module.exports = {
  requestContextMiddleware: httpLogger,
};
