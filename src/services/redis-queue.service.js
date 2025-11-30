// Redis queue service for background job processing
import redis from '../config/redis.js';

// Queue names
const QUEUE_DOCUMENT_PROCESSING = 'queue:document:processing';
const QUEUE_FEEDBACK_PROCESSING = 'queue:feedback:processing';
const QUEUE_WEBHOOK = 'queue:webhook';

/**
 * Push document processing job to queue
 */
export const pushDocumentJob = async (documentId, fileName) => {
  try {
    const job = {
      documentId,
      fileName,
      createdAt: Date.now(),
    };
    await redis.lpush(QUEUE_DOCUMENT_PROCESSING, JSON.stringify(job));
    return true;
  } catch (error) {
    console.error('Redis push document job error:', error);
    return false;
  }
};

/**
 * Pop document processing job from queue (blocking)
 */
export const popDocumentJob = async (timeout = 0) => {
  try {
    const result = await redis.brpop(QUEUE_DOCUMENT_PROCESSING, timeout);
    if (result && result[1]) {
      return JSON.parse(result[1]);
    }
    return null;
  } catch (error) {
    console.error('Redis pop document job error:', error);
    return null;
  }
};

/**
 * Push feedback processing job
 */
export const pushFeedbackJob = async (queryId, answerId, feedback) => {
  try {
    const job = {
      queryId,
      answerId,
      feedback,
      createdAt: Date.now(),
    };
    await redis.lpush(QUEUE_FEEDBACK_PROCESSING, JSON.stringify(job));
    return true;
  } catch (error) {
    console.error('Redis push feedback job error:', error);
    return false;
  }
};

/**
 * Pop feedback processing job
 */
export const popFeedbackJob = async (timeout = 0) => {
  try {
    const result = await redis.brpop(QUEUE_FEEDBACK_PROCESSING, timeout);
    if (result && result[1]) {
      return JSON.parse(result[1]);
    }
    return null;
  } catch (error) {
    console.error('Redis pop feedback job error:', error);
    return null;
  }
};

/**
 * Push webhook job (simulate webhook call)
 */
export const pushWebhookJob = async (event, data) => {
  try {
    const job = {
      event,
      data,
      createdAt: Date.now(),
      retries: 0,
    };
    await redis.lpush(QUEUE_WEBHOOK, JSON.stringify(job));
    return true;
  } catch (error) {
    console.error('Redis push webhook job error:', error);
    return false;
  }
};

/**
 * Pop webhook job
 */
export const popWebhookJob = async (timeout = 0) => {
  try {
    const result = await redis.brpop(QUEUE_WEBHOOK, timeout);
    if (result && result[1]) {
      return JSON.parse(result[1]);
    }
    return null;
  } catch (error) {
    console.error('Redis pop webhook job error:', error);
    return null;
  }
};

/**
 * Get queue length
 */
export const getQueueLength = async (queueName) => {
  try {
    return await redis.llen(queueName);
  } catch (error) {
    console.error('Redis get queue length error:', error);
    return 0;
  }
};

/**
 * Get all queue lengths
 */
export const getAllQueueLengths = async () => {
  try {
    const [doc, feedback, webhook] = await Promise.all([
      getQueueLength(QUEUE_DOCUMENT_PROCESSING),
      getQueueLength(QUEUE_FEEDBACK_PROCESSING),
      getQueueLength(QUEUE_WEBHOOK),
    ]);
    return {
      documentProcessing: doc,
      feedbackProcessing: feedback,
      webhook: webhook,
    };
  } catch (error) {
    console.error('Redis get all queue lengths error:', error);
    return { documentProcessing: 0, feedbackProcessing: 0, webhook: 0 };
  }
};

export default {
  pushDocumentJob,
  popDocumentJob,
  pushFeedbackJob,
  popFeedbackJob,
  pushWebhookJob,
  popWebhookJob,
  getQueueLength,
  getAllQueueLengths,
  QUEUE_DOCUMENT_PROCESSING,
  QUEUE_FEEDBACK_PROCESSING,
  QUEUE_WEBHOOK,
};

