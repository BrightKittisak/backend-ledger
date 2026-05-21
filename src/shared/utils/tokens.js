const jwt = require('jsonwebtoken');

const { config } = require('../config/env');

function signAccessToken(userId) {
  return jwt.sign(
    {
      sub: userId,
      type: 'access',
    },
    config.accessTokenSecret,
    {
      expiresIn: `${config.accessTokenTtlMinutes}m`,
    },
  );
}

function signRefreshToken({ sessionId, userId }) {
  return jwt.sign(
    {
      sid: sessionId,
      sub: userId,
      type: 'refresh',
    },
    config.refreshTokenSecret,
    {
      expiresIn: `${config.refreshTokenTtlDays}d`,
    },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.accessTokenSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.refreshTokenSecret);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
