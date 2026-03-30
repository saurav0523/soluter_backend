import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, '../../.env');
const backendEnvPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: backendEnvPath });

import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import uploadRoutes from './routes/upload.routes.js';
import askRoutes from './routes/ask.routes.js';
import docRoutes from './routes/doc.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Soluter Backend API Documentation',
}));

app.use('/api/upload', uploadRoutes);
app.use('/api/ask', askRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/feedback', feedbackRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Soluter Backend API',
    docs: '/api-docs',
    health: '/health'
  });
});

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

