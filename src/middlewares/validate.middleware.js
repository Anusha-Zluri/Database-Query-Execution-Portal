const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const data = source === 'query' ? req.query : 
                   source === 'params' ? req.params : 
                   req.body;
      
      const validated = schema.parse(data);
      
      // Replace with validated data (includes type coercion)
      if (source === 'query') req.query = validated;
      else if (source === 'params') req.params = validated;
      else req.body = validated;
      
      next();
    } catch (error) {
      // Check if it's a ZodError (has issues property)
      if (error.issues && Array.isArray(error.issues)) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        });
      }
      
      // If not a Zod error, pass to next error handler
      next(error);
    }
  };
};

module.exports = { validate };
