// Import config first to load environment variables
import './config/env.js';
import { config } from './config/env.js';
import app from './app.js';

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

