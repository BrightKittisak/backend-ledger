const { z } = require('zod');

const { isValidAccountNumber } = require('../../shared/utils/account-number');

const transferHeadersSchema = z.object({
  'idempotency-key': z.string().trim().min(1),
});

const transferBodySchema = z.object({
  amountMinor: z.number().int().positive(),
  metadata: z
    .object({
      note: z.string().trim().min(1).max(255).optional(),
    })
    .default({}),
  toAccountNumber: z
    .string()
    .refine((value) => isValidAccountNumber(value), 'Account number is invalid'),
});

module.exports = {
  transferBodySchema,
  transferHeadersSchema,
};
