import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import crypto from 'crypto';

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  })
  : new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
    tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

export const upstash = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new UpstashRedis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  : null;

redis.on('connect', () => {
  console.log('Redis TCP client connected');
});

redis.on('ready', () => {
  console.log('Redis TCP client ready');
});

redis.on('error', (error) => {
  console.error('Redis TCP client error:', error.message);
});

redis.on('close', () => {
  console.log('Redis TCP client connection closed');
});

process.on('beforeExit', async () => {
  await redis.quit();
});

export const normalizeQuestion = (question) => {
  return question
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
};

export const hashQuestion = (question) => {
  return crypto.createHash('sha1').update(normalizeQuestion(question)).digest('hex');
};

export default redis;

