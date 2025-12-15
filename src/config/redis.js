import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
};

// Add TLS for production (Upstash, etc.)
if (process.env.REDIS_TLS === 'true') {
  redisConfig.tls = {
    rejectUnauthorized: false
  };
}

const redis = new Redis(redisConfig);

// Redis connection event handlers
redis.on('connect', () => {
  console.log('Redis client connected');
});

redis.on('ready', () => {
  console.log('Redis client ready');
});

redis.on('error', (error) => {
  console.error('Redis client error:', error);
});

redis.on('close', () => {
  console.log('Redis client connection closed');
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await redis.quit();
});

// Helper function to normalize question for cache key
export const normalizeQuestion = (question) => {
  return question
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
};

// Helper function to generate cache key hash
import crypto from 'crypto';

export const hashQuestion = (question) => {
  return crypto.createHash('sha1').update(normalizeQuestion(question)).digest('hex');
};

export default redis;

