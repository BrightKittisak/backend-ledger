const { config } = require('../config/env');

function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    path: '/api/v1/auth',
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
  };
}

module.exports = {
  getRefreshCookieOptions,
};
