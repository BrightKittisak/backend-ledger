const { ulid } = require('ulid');

function generatePublicId() {
  return ulid();
}

module.exports = {
  generatePublicId,
};
