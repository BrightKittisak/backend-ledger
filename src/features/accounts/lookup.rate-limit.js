const rateLimit = require('express-rate-limit');

const { config } = require('../../shared/config/env');

const lookupRateLimit = rateLimit({
  limit: config.rateLimits.lookup.max,
  standardHeaders: true,
  windowMs: config.rateLimits.lookup.windowMs,
});

module.exports = {
  lookupRateLimit,
};
