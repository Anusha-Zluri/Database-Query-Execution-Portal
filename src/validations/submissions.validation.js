const { z } = require('zod');

// Submission ID parameter
const submissionIdParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a valid number')
    .transform(Number)
    .refine(val => val > 0, 'ID must be greater than 0')
});

// Pagination query parameters
const paginationQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/, 'Page must be a valid number')
    .transform(Number)
    .refine(val => val > 0, 'Page must be greater than 0')
    .optional()
    .default('1'),
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a valid number')
    .transform(Number)
    .refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default('10'),
  status: z.enum(['ALL', 'PENDING', 'EXECUTED', 'REJECTED', 'FAILED'])
    .optional()
    .default('ALL')
});

// Update draft body
const updateDraftSchema = z.object({
  pod_id: z.string()
    .regex(/^\d+$/, 'POD ID must be a valid number')
    .transform(Number)
    .refine(val => val > 0, 'POD ID must be greater than 0'),
  db_instance: z.string()
    .min(1, 'Database instance is required')
    .max(100, 'Database instance name too long'),
  db_name: z.string()
    .min(1, 'Database name is required')
    .max(100, 'Database name too long'),
  comment: z.string()
    .min(1, 'Comment is required')
    .max(1000, 'Comment must be less than 1000 characters')
    .trim(),
  content: z.string()
    .max(50000, 'Content must be less than 50,000 characters')
    .optional()
});

module.exports = {
  submissionIdParamSchema,
  paginationQuerySchema,
  updateDraftSchema
};
