import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });
export const config = {
  databaseUrl: process.env.DATABASE_URL,
  port: process.env.PORT || 3005,
  nodeEnv: process.env.NODE_ENV,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  ollamaModel: process.env.OLLAMA_MODEL,
  ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE),
  uploadDir: process.env.UPLOAD_DIR,
  // Redis configuration
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT) || 6379,
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  redisDb: parseInt(process.env.REDIS_DB) || 0,
  // Google Cloud Storage configuration (optional)
  gcsBucketName: process.env.GCS_BUCKET_NAME || undefined,
  gcsCredentialsPath: process.env.GCS_CREDENTIALS_PATH || undefined,
  gcsProjectId: process.env.GCS_PROJECT_ID || undefined,
};

