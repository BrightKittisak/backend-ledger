const { z } = require('zod');

const publicAccountIdParamsSchema = z.object({
  publicAccountId: z.string().min(1),
});

module.exports = {
  publicAccountIdParamsSchema,
};
