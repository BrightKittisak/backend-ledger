const rateLimit = require('express-rate-limit');

const { config } = require('../../shared/config/env');

const authRateLimit = rateLimit({
  limit: config.rateLimits.auth.max,
  standardHeaders: true,
  windowMs: config.rateLimits.auth.windowMs,
});

module.exports = {
  authRateLimit,
};
