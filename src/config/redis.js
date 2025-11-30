// Import env first to ensure environment variables are loaded
import './env.js';
import Redis from 'ioredis';
import { config } from './env.js';

// Create Redis client with connection pooling
const redis = new Redis({
  host: config.redisHost || 'localhost',
  port: config.redisPort || 6379,
  password: config.redisPassword || undefined,
  db: config.redisDb || 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

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

