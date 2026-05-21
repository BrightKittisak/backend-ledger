const { z } = require('zod');

const { idempotencyHeadersSchema } = require('../idempotency/idempotency.schemas');

const withdrawalBodySchema = z.object({
  amountMinor: z.number().int().positive(),
  metadata: z.object({
    bankAccountName: z.string().trim().min(1).max(255),
    bankAccountNumber: z.string().trim().min(4).max(50),
    bankName: z.string().trim().min(1).max(255),
    note: z.string().trim().min(1).max(255).optional(),
  }),
});

module.exports = {
  withdrawalBodySchema,
  withdrawalHeadersSchema: idempotencyHeadersSchema,
};
