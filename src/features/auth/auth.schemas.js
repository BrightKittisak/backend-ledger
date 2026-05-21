const { z } = require('zod');

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, 'Must include an uppercase character')
  .regex(/[a-z]/, 'Must include a lowercase character')
  .regex(/[0-9]/, 'Must include a number');

const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

const registerBodySchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1),
  password: passwordSchema,
});

const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

const refreshHeadersSchema = z.object({
  'x-csrf-token': z.string().min(1),
});

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

module.exports = {
  changePasswordBodySchema,
  loginBodySchema,
  refreshHeadersSchema,
  registerBodySchema,
};
