const { z } = require('zod');

const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .max(255, 'Email too long'),
  password: z.string()
    .min(1, 'Password is required')
    .max(255, 'Password too long')
});

module.exports = {
  loginSchema
};
