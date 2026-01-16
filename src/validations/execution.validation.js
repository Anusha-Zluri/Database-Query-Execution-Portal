const { z } = require('zod');

// Execution ID parameter
const executionIdParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a valid number')
    .transform(Number)
    .refine(val => val > 0, 'ID must be greater than 0')
});

module.exports = {
  executionIdParamSchema
};
