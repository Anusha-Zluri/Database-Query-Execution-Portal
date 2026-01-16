const { z } = require('zod');

// Query parameters for getting approvals
const getApprovalsQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/, 'Page must be a number')
    .transform(Number)
    .refine(val => val > 0, 'Page must be greater than 0')
    .optional(),
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: 'Status must be PENDING, APPROVED, or REJECTED' })
  }).optional(),
  pod: z.string().min(1, 'POD name cannot be empty').max(100, 'POD name too long').optional(),
  pod_id: z.string()
    .regex(/^\d+$/, 'POD ID must be a number')
    .transform(Number)
    .refine(val => val > 0, 'POD ID must be greater than 0')
    .optional(),
  search: z.string().max(500, 'Search query too long').optional(),
  dateFrom: z.string().datetime({ message: 'Invalid date format for dateFrom' }).optional(),
  dateTo: z.string().datetime({ message: 'Invalid date format for dateTo' }).optional()
}).refine(
  (data) => {
    // If both dates provided, dateFrom must be before dateTo
    if (data.dateFrom && data.dateTo) {
      return new Date(data.dateFrom) <= new Date(data.dateTo);
    }
    return true;
  },
  {
    message: 'dateFrom must be before or equal to dateTo',
    path: ['dateFrom']
  }
);

// Path parameter for approval ID
const approvalIdParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a valid number')
    .transform(Number)
    .refine(val => val > 0, 'ID must be greater than 0')
});

// Body for reject request
const rejectRequestSchema = z.object({
  reason: z.string()
    .min(1, 'Rejection reason is required')
    .max(500, 'Reason must be less than 500 characters')
    .trim()
});

module.exports = {
  getApprovalsQuerySchema,
  approvalIdParamSchema,
  rejectRequestSchema
};
