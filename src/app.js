// Import config first to ensure environment variables are loaded
import './config/env.js';

import express from 'express';
import cors from 'cors';
import uploadRoutes from './routes/upload.routes.js';
import askRoutes from './routes/ask.routes.js';
import docRoutes from './routes/doc.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/upload', uploadRoutes);
app.use('/api/ask', askRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/feedback', feedbackRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

export default app;

