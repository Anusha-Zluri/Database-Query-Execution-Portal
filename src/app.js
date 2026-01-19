const express = require('express');
const cors = require("cors");
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger.config');

const app = express();

// Import routes
const authRoutes = require('./routes/auth.routes');
const requestRoutes = require('./routes/requests.routes');
const approvalsRoutes = require('./routes/approvals.routes');
const executionRoutes = require('./routes/execution.routes');
const submissionsRoutes = require('./routes/submissions.routes');
const podsRoutes = require('./routes/pods.routes');
const analyticsRoutes = require('./routes/analytics.routes');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  const ExecutionWatchdog = require('./services/execution.watchdog.service');
  const metricsService = require('./services/metrics.service');
  const executionSemaphore = require('./services/execution.semaphore');
  
  const healthStatus = metricsService.getHealthStatus();
  const activeExecutions = ExecutionWatchdog.getActiveExecutions();
  const semaphoreStats = executionSemaphore.getStats();
  
  // Alert checks
  const alerts = [];
  
  if (semaphoreStats.current >= semaphoreStats.max * 0.9) {
    alerts.push('CRITICAL: Near max concurrency');
  }
  
  if (semaphoreStats.queued > semaphoreStats.maxQueueSize * 0.8) {
    alerts.push('CRITICAL: Queue nearly full');
  }
  
  if (semaphoreStats.queued > 10) {
    alerts.push('WARNING: Execution queue building up');
  }
  
  if (activeExecutions.length > 15) {
    alerts.push('WARNING: High number of active executions');
  }
  
  const metrics = metricsService.getMetrics();
  if (metrics.executionsKilledByWatchdog > 10) {
    alerts.push('WARNING: Many watchdog kills detected');
  }
  
  if (metrics.backendsTerminated > 20) {
    alerts.push('WARNING: Many backend terminations');
  }
  
  const health = {
    status: alerts.some(a => a.startsWith('CRITICAL')) ? 'critical' : healthStatus.status,
    alerts,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
    },
    activeExecutions: {
      count: ExecutionWatchdog.getActiveCount(),
      details: activeExecutions
    },
    semaphore: semaphoreStats,
    warnings: healthStatus.warnings,
    metrics: healthStatus.metrics
  };
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Metrics endpoint (Prometheus format)
app.get('/metrics', (req, res) => {
  const metricsService = require('./services/metrics.service');
  res.set('Content-Type', 'text/plain');
  res.send(metricsService.getPrometheusMetrics());
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: `
    /* Dark theme with black/green colors */
    .swagger-ui { background: #000000; }
    .swagger-ui .topbar { display: none; }
    
    /* Main container */
    .swagger-ui .wrapper { background: #000000; }
    .swagger-ui .information-container { background: #0a0a0a; padding: 30px; border-radius: 12px; border: 1px solid #1e293b; margin-bottom: 20px; }
    
    /* Title and description */
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { 
      background: linear-gradient(to right, #1a9d7c, #14b8a6, #0d9488);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-size: 36px;
      font-weight: bold;
    }
    .swagger-ui .info .version { color: #14b8a6 !important; font-size: 14px; margin-left: 10px; }
    .swagger-ui .info .description { color: #ffffff; }
    .swagger-ui .info p { color: #ffffff; }
    .swagger-ui .info a { color: #14b8a6; }
    .swagger-ui .info a:hover { color: #1a9d7c; }
    .swagger-ui .info h1, .swagger-ui .info h2, .swagger-ui .info h3 { color: #ffffff; }
    .swagger-ui .info ul, .swagger-ui .info ol { color: #ffffff; }
    .swagger-ui .info li { color: #ffffff; }
    .swagger-ui .info strong { color: #ffffff; }
    .swagger-ui .info code { color: #14b8a6; background: #0f172a; }
    .swagger-ui .markdown p { color: #ffffff; }
    .swagger-ui .markdown li { color: #ffffff; }
    .swagger-ui .markdown h1, .swagger-ui .markdown h2, .swagger-ui .markdown h3 { color: #ffffff; }
    .swagger-ui .markdown strong { color: #ffffff; }
    .swagger-ui .renderedMarkdown p { color: #ffffff !important; }
    .swagger-ui .renderedMarkdown li { color: #ffffff !important; }
    .swagger-ui .renderedMarkdown h1, .swagger-ui .renderedMarkdown h2, .swagger-ui .renderedMarkdown h3 { color: #ffffff !important; }
    
    /* Scheme container */
    .swagger-ui .scheme-container { 
      background: #0f172a; 
      padding: 15px; 
      border-radius: 8px; 
      border: 1px solid #1e293b;
    }
    .swagger-ui .scheme-container .schemes > label { color: #ffffff; }
    
    /* Server selection - keep visible but style it */
    .swagger-ui .servers > label { 
      font-weight: bold; 
      color: #ffffff; 
    }
    .swagger-ui .servers > label > select { 
      margin-left: 10px; 
      padding: 8px;
      background: #0a0a0a;
      border: 1px solid #1e293b;
      color: #ffffff;
      border-radius: 6px;
    }
    
    /* Auth section */
    .swagger-ui .auth-wrapper { 
      padding: 20px; 
      background: #0f172a; 
      border-radius: 8px; 
      border: 1px solid #1e293b;
    }
    .swagger-ui .btn.authorize { 
      background: linear-gradient(to right, #1a9d7c, #14b8a6);
      border: none;
      color: white;
      font-weight: 600;
      transition: all 0.3s;
    }
    .swagger-ui .btn.authorize:hover { 
      box-shadow: 0 0 20px rgba(26, 157, 124, 0.5);
      transform: scale(1.02);
    }
    .swagger-ui .btn.authorize svg { fill: white; }
    
    /* Operation blocks */
    .swagger-ui .opblock { 
      background: #0a0a0a; 
      border: 1px solid #1e293b; 
      border-radius: 8px; 
      margin-bottom: 15px;
    }
    .swagger-ui .opblock .opblock-summary { background: #0f172a; }
    .swagger-ui .opblock .opblock-summary:hover { background: #1e293b; }
    .swagger-ui .opblock .opblock-summary-path { color: #ffffff; }
    .swagger-ui .opblock .opblock-summary-path__deprecated { color: #ffffff; }
    .swagger-ui .opblock .opblock-summary-description { color: #ffffff; }
    .swagger-ui .opblock-tag { color: #ffffff; }
    .swagger-ui .opblock-tag-section { color: #ffffff; }
    .swagger-ui .opblock-tag small { color: #ffffff; }
    
    /* POST operations - green */
    .swagger-ui .opblock.opblock-post { border-color: #1a9d7c; }
    .swagger-ui .opblock.opblock-post .opblock-summary { border-color: #1a9d7c; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #1a9d7c; }
    
    /* GET operations - teal */
    .swagger-ui .opblock.opblock-get { border-color: #14b8a6; }
    .swagger-ui .opblock.opblock-get .opblock-summary { border-color: #14b8a6; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #14b8a6; }
    
    /* PATCH operations - cyan */
    .swagger-ui .opblock.opblock-patch { border-color: #0d9488; }
    .swagger-ui .opblock.opblock-patch .opblock-summary { border-color: #0d9488; }
    .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #0d9488; }
    
    /* DELETE operations - red but muted */
    .swagger-ui .opblock.opblock-delete { border-color: #dc2626; }
    .swagger-ui .opblock.opblock-delete .opblock-summary { border-color: #dc2626; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #dc2626; }
    
    /* Text colors */
    .swagger-ui .opblock-summary-path { color: #ffffff; }
    .swagger-ui .opblock-summary-description { color: #ffffff; }
    .swagger-ui .opblock-section-header { background: #0f172a; color: #ffffff; }
    .swagger-ui .opblock-description-wrapper p { color: #ffffff; }
    .swagger-ui .opblock-body pre { background: #0a0a0a; border: 1px solid #1e293b; color: #ffffff; }
    
    /* Parameters */
    .swagger-ui .parameter__name { font-weight: bold; color: #14b8a6; }
    .swagger-ui .parameter__type { color: #ffffff; }
    .swagger-ui .parameter__in { color: #ffffff; }
    .swagger-ui table thead tr th { color: #ffffff; background: #0f172a; border-color: #1e293b; }
    .swagger-ui table tbody tr td { color: #ffffff; border-color: #1e293b; }
    
    /* Responses */
    .swagger-ui .response-col_status { font-weight: bold; color: #14b8a6; }
    .swagger-ui .response-col_description { color: #ffffff; }
    .swagger-ui .responses-inner h4 { color: #ffffff; }
    .swagger-ui .responses-inner h5 { color: #ffffff; }
    
    /* Models */
    .swagger-ui .model-box { background: #0f172a; border: 1px solid #1e293b; }
    .swagger-ui .model-title { color: #ffffff; }
    .swagger-ui .model { color: #ffffff; }
    .swagger-ui .prop-type { color: #14b8a6; }
    .swagger-ui .prop-format { color: #ffffff; }
    
    /* Buttons */
    .swagger-ui .btn { 
      background: #1a9d7c; 
      color: white; 
      border: none;
      transition: all 0.3s;
    }
    .swagger-ui .btn:hover { 
      background: #14b8a6;
      box-shadow: 0 0 15px rgba(26, 157, 124, 0.3);
    }
    .swagger-ui .btn-clear { background: #334155; }
    .swagger-ui .btn-clear:hover { background: #475569; }
    
    /* Inputs */
    .swagger-ui input[type=text], 
    .swagger-ui input[type=password],
    .swagger-ui textarea,
    .swagger-ui select {
      background: #0a0a0a;
      border: 1px solid #1e293b;
      color: #ffffff;
    }
    .swagger-ui input[type=text]:focus,
    .swagger-ui input[type=password]:focus,
    .swagger-ui textarea:focus {
      border-color: #1a9d7c;
      outline: none;
      box-shadow: 0 0 0 2px rgba(26, 157, 124, 0.2);
    }
    
    /* Server selection */
    .swagger-ui .servers > label { font-weight: bold; color: #ffffff; }
    .swagger-ui .servers > label > select { 
      margin-left: 10px; 
      padding: 8px;
      background: #0a0a0a;
      border: 1px solid #1e293b;
      color: #ffffff;
      border-radius: 6px;
    }
    
    /* Try it out */
    .swagger-ui .try-out { background: #0f172a; }
    .swagger-ui .try-out__btn { 
      background: #1a9d7c;
      color: white;
      border: none;
    }
    .swagger-ui .try-out__btn:hover { background: #14b8a6; }
    
    /* Execute button */
    .swagger-ui .execute-wrapper .btn { 
      background: linear-gradient(to right, #1a9d7c, #14b8a6);
      font-weight: 600;
    }
    
    /* Scrollbars */
    .swagger-ui ::-webkit-scrollbar { width: 10px; height: 10px; }
    .swagger-ui ::-webkit-scrollbar-track { background: #0a0a0a; }
    .swagger-ui ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 5px; }
    .swagger-ui ::-webkit-scrollbar-thumb:hover { background: #334155; }
  `,
  customSiteTitle: 'Database Portal API Documentation',
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
    exposedHeaders: ['Content-Disposition'], // Allow frontend to read this header
  })
);

// Register routes
app.use('/auth', authRoutes);
app.use('/requests', requestRoutes);
app.use('/approvals', approvalsRoutes);
app.use('/', executionRoutes);
app.use('/execution', executionRoutes);
app.use('/pods', podsRoutes);
app.use('/analytics', analyticsRoutes);
app.use(submissionsRoutes);

module.exports = app;
