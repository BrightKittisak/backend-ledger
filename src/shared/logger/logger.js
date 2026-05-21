const pino = require('pino');

const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    censor: '[REDACTED]',
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.password',
      'req.cookies',
      'refreshToken',
      'token',
      'metadata.bankAccountNumber',
    ],
  },
});

module.exports = {
  logger,
};
