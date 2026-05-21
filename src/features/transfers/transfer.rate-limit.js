const rateLimit = require('express-rate-limit');

const { config } = require('../../shared/config/env');

const transferRateLimit = rateLimit({
  limit: config.rateLimits.money.max,
  standardHeaders: true,
  windowMs: config.rateLimits.money.windowMs,
});

module.exports = {
  transferRateLimit,
};
