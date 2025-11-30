// Redis timeout service using sorted sets for managing query timeouts
import redis from '../config/redis.js';

const TIMEOUT_SET = 'timeouts:queries';
const DEFAULT_TIMEOUT = 600; // 10 minutes in seconds

/**
 * Set timeout for a query
 */
export const setTimeout = async (queryId, timeoutSeconds = DEFAULT_TIMEOUT) => {
  try {
    const expiryTimestamp = Date.now() + (timeoutSeconds * 1000);
    await redis.zadd(TIMEOUT_SET, expiryTimestamp, queryId);
    return true;
  } catch (error) {
    console.error('Redis set timeout error:', error);
    return false;
  }
};

/**
 * Remove timeout for a query (when resolved)
 */
export const clearTimeout = async (queryId) => {
  try {
    await redis.zrem(TIMEOUT_SET, queryId);
    return true;
  } catch (error) {
    console.error('Redis clear timeout error:', error);
    return false;
  }
};

/**
 * Get expired queries (queries that have passed their timeout)
 */
export const getExpiredQueries = async () => {
  try {
    const now = Date.now();
    const expired = await redis.zrangebyscore(TIMEOUT_SET, 0, now);
    return expired;
  } catch (error) {
    console.error('Redis get expired queries error:', error);
    return [];
  }
};

/**
 * Get all pending queries with their expiry times
 */
export const getPendingQueries = async () => {
  try {
    const now = Date.now();
    const pending = await redis.zrangebyscore(TIMEOUT_SET, now, '+inf', 'WITHSCORES');
    const result = [];
    for (let i = 0; i < pending.length; i += 2) {
      result.push({
        queryId: pending[i],
        expiresAt: parseInt(pending[i + 1]),
        timeRemaining: Math.max(0, parseInt(pending[i + 1]) - now),
      });
    }
    return result;
  } catch (error) {
    console.error('Redis get pending queries error:', error);
    return [];
  }
};

/**
 * Check if a query has expired
 */
export const isExpired = async (queryId) => {
  try {
    const score = await redis.zscore(TIMEOUT_SET, queryId);
    if (!score) return false; // Not in timeout set
    return Date.now() > parseInt(score);
  } catch (error) {
    console.error('Redis check expired error:', error);
    return false;
  }
};

/**
 * Get time remaining for a query
 */
export const getTimeRemaining = async (queryId) => {
  try {
    const score = await redis.zscore(TIMEOUT_SET, queryId);
    if (!score) return null;
    const remaining = parseInt(score) - Date.now();
    return Math.max(0, remaining);
  } catch (error) {
    console.error('Redis get time remaining error:', error);
    return null;
  }
};

export default {
  setTimeout,
  clearTimeout,
  getExpiredQueries,
  getPendingQueries,
  isExpired,
  getTimeRemaining,
};

