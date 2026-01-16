const { z } = require('zod');

// Submit request body
const submitRequestSchema = z.object({
  request_type: z.enum(['QUERY', 'SCRIPT'], {
    errorMap: () => ({ message: 'Request type must be QUERY or SCRIPT' })
  }),
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
  content: z.string()
    .max(50000, 'Query content must be less than 50,000 characters')
    .optional(),
  comment: z.string()
    .min(1, 'Comment is required')
    .trim()
}).refine(
  (data) => {
    // If QUERY type, content is required
    if (data.request_type === 'QUERY') {
      return data.content && data.content.trim().length > 0;
    }
    return true;
  },
  {
    message: 'Query content is required for QUERY type',
    path: ['content']
  }
);

// Request ID parameter
const requestIdParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a valid number')
    .transform(Number)
    .refine(val => val > 0, 'ID must be greater than 0')
});

// Get instances query
const getInstancesQuerySchema = z.object({
  type: z.enum(['postgres', 'mongodb'], {
    errorMap: () => ({ message: 'Type must be postgres or mongodb' })
  }).optional()
});

// Get databases query
const getDatabasesQuerySchema = z.object({
  instance: z.string()
    .min(1, 'Instance name is required')
    .max(100, 'Instance name too long')
});

module.exports = {
  submitRequestSchema,
  requestIdParamSchema,
  getInstancesQuerySchema,
  getDatabasesQuerySchema
};
