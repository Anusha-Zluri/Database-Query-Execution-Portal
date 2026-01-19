const express = require('express');
const cors = require("cors");
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger.config');

const app = express();
const authRoutes = require('./routes/auth.routes');
const requestRoutes = require('./routes/requests.routes');
const approvalsRoutes = require('./routes/approvals.routes');
const executionRoutes = require('./routes/execution.routes');
const submissionsRoutes = require('./routes/submissions.routes');
const podsRoutes = require('./routes/pods.routes');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Middleware
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #3b4151; font-size: 36px; }
    .swagger-ui .scheme-container { background: #f7f7f7; padding: 15px; border-radius: 4px; }
    .swagger-ui .auth-wrapper { padding: 20px; background: #f9f9f9; border-radius: 8px; }
    .swagger-ui .btn.authorize { background-color: #49cc90; border-color: #49cc90; }
    .swagger-ui .btn.authorize:hover { background-color: #3ea175; }
    .swagger-ui .opblock.opblock-post { border-color: #49cc90; }
    .swagger-ui .opblock.opblock-post .opblock-summary { border-color: #49cc90; }
    .swagger-ui .opblock.opblock-get { border-color: #61affe; }
    .swagger-ui .opblock.opblock-get .opblock-summary { border-color: #61affe; }
    .swagger-ui .opblock.opblock-patch { border-color: #50e3c2; }
    .swagger-ui .opblock.opblock-patch .opblock-summary { border-color: #50e3c2; }
    .swagger-ui .parameter__name { font-weight: bold; }
    .swagger-ui .response-col_status { font-weight: bold; }
    .swagger-ui .model-box { background: #f8f8f8; }
    .swagger-ui .servers > label { font-weight: bold; color: #3b4151; }
    .swagger-ui .servers > label > select { margin-left: 10px; padding: 5px; }
  `,
  customSiteTitle: '🗄️ Database Portal API Documentation',
  customfavIcon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🗄️</text></svg>',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    displayOperationId: false,
    tryItOutEnabled: true,
    requestInterceptor: (req) => {
      // Ensure CORS headers for local development
      if (req.url.includes('localhost')) {
        req.headers['Access-Control-Allow-Origin'] = '*';
      }
      return req;
    }
  }
}));

// API info endpoint with enhanced information
app.get('/api-info', (req, res) => {
  res.json({
    title: '🗄️ Database Query Execution Portal API',
    version: '1.0.0',
    description: 'Secure database operations with approval workflows',
    documentation: {
      swagger: '/api-docs',
      interactive: 'https://database-query-execution-portal.onrender.com/api-docs'
    },
    endpoints: {
      health: '/health',
      auth: '/auth/*',
      requests: '/requests/*',
      approvals: '/approvals/*',
      execution: '/execute/*',
      pods: '/pods',
      submissions: '/submissions/*'
    },
    features: [
      'JWT Authentication',
      'Multi-database support (PostgreSQL, MongoDB)',
      'Approval workflow system',
      'Secure VM script execution',
      'CSV result exports',
      'Audit trail tracking'
    ],
    links: {
      frontend: 'https://database-query-execution-portal.vercel.app',
      repository: 'https://github.com/your-repo/database-portal'
    }
  });
});

// Routes
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000", // Add this for Swagger UI
  "https://database-query-execution-portal.vercel.app",
  "https://database-query-execution-portal.onrender.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      // Check if origin matches allowed origins or is a Vercel preview deployment
      if (allowedOrigins.indexOf(origin) !== -1 || 
          (origin && origin.includes('database-query-execution-portal') && origin.includes('vercel.app'))) {
        callback(null, true);
      } else {
        console.log('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use('/auth', authRoutes);
app.use('/requests', requestRoutes);
app.use('/approvals', approvalsRoutes);
app.use('/', executionRoutes);
app.use('/execution', executionRoutes)
app.use('/pods', podsRoutes);
app.use(submissionsRoutes);









module.exports = app;
