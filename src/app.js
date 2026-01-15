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
app.use(
  cors({
    origin: "http://localhost:5173",
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
