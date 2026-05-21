const { z } = require('zod');

const idempotencyHeadersSchema = z.object({
  'idempotency-key': z.string().trim().min(1),
});

module.exports = {
  idempotencyHeadersSchema,
};
