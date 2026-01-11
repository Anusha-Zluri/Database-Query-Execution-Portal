const express = require('express');
const app = express();

const authRoutes = require('./routes/auth.routes');
const requestRoutes = require('./routes/requests.routes');
const approvalsRoutes = require('./routes/approvals.routes');
const executionRoutes = require('./routes/execution.routes');
const submissionsRoutes = require('./routes/submissions.routes');


// Middleware
app.use(express.json());


app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/auth', authRoutes);
app.use('/requests', requestRoutes);
app.use('/approvals', approvalsRoutes);
app.use('/', executionRoutes);
app.use('/execution', executionRoutes)
app.use(submissionsRoutes);









module.exports = app;
