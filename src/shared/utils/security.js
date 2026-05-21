const crypto = require('crypto');

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  hashValue,
  randomToken,
};
