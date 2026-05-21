const rateLimit = require('express-rate-limit');

const { config } = require('../config/env');

const moneyRateLimit = rateLimit({
  limit: config.rateLimits.money.max,
  standardHeaders: true,
  windowMs: config.rateLimits.money.windowMs,
});

module.exports = {
  moneyRateLimit,
};
