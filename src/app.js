const express = require('express');

const cors = require("cors");

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

// Routes
const allowedOrigins = [
  "http://localhost:5173",
  "https://database-query-execution-portal.vercel.app"
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
