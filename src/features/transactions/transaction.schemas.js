const { z } = require('zod');

const transactionHistoryQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  page: z.coerce.number().int().positive().default(1),
  to: z.string().datetime({ offset: true }).optional(),
  type: z.enum(['DEPOSIT', 'TRANSFER', 'WITHDRAW']).optional(),
});

const publicTransactionIdParamsSchema = z.object({
  publicTransactionId: z.string().trim().min(1),
});

module.exports = {
  publicTransactionIdParamsSchema,
  transactionHistoryQuerySchema,
};
