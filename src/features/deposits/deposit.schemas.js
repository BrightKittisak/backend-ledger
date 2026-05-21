const { z } = require('zod');

const { isValidAccountNumber } = require('../../shared/utils/account-number');
const { idempotencyHeadersSchema } = require('../idempotency/idempotency.schemas');

const depositBodySchema = z.object({
  amountMinor: z.number().int().positive(),
  metadata: z.object({
    reason: z.string().trim().min(1).max(255),
  }),
  toAccountNumber: z
    .string()
    .refine((value) => isValidAccountNumber(value), 'Account number is invalid'),
});

module.exports = {
  depositBodySchema,
  depositHeadersSchema: idempotencyHeadersSchema,
};
