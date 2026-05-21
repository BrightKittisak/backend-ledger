const { z } = require('zod');
const { isValidAccountNumber } = require('../../shared/utils/account-number');

const publicAccountIdParamsSchema = z.object({
  publicAccountId: z.string().min(1),
});

const accountLookupQuerySchema = z.object({
  accountNumber: z
    .string()
    .refine((value) => isValidAccountNumber(value), 'Account number is invalid'),
});

module.exports = {
  accountLookupQuerySchema,
  publicAccountIdParamsSchema,
};
