// Background worker for processing Redis queues
import redisQueue from '../services/redis-queue.service.js';
import prisma from '../config/db.js';

let isRunning = false;
let shouldStop = false;

/**
 * Process document jobs
 */
const processDocumentJob = async (job) => {
  try {
    console.log(`Processing document job: ${job.documentId} - ${job.fileName}`);
    
    // Simulate webhook/notification
    console.log(`[Webhook Simulation] Document ${job.fileName} processed successfully`);
    
    // You can add analytics, notifications, etc. here
    // For example: send email, update analytics, trigger downstream processes
    
    return true;
  } catch (error) {
    console.error('Error processing document job:', error);
    return false;
  }
};

/**
 * Process feedback jobs
 */
const processFeedbackJob = async (job) => {
  try {
    console.log(`Processing feedback job: Query ${job.queryId}, Answer ${job.answerId}`);
    
    // Simulate webhook/notification
    console.log(`[Webhook Simulation] Feedback received for query ${job.queryId}:`, {
      rating: job.feedback.rating,
      isHelpful: job.feedback.isHelpful,
    });
    
    // You can add analytics, notifications, etc. here
    // For example: update analytics dashboard, send notification to admin
    
    return true;
  } catch (error) {
    console.error('Error processing feedback job:', error);
    return false;
  }
};

/**
 * Process webhook jobs
 */
const processWebhookJob = async (job) => {
  try {
    console.log(`[Webhook] ${job.event}:`, job.data);
    
    // Simulate webhook call
    // In production, this would make an HTTP request to the webhook URL
    // For now, just log it
    
    return true;
  } catch (error) {
    console.error('Error processing webhook job:', error);
    // Retry logic could be added here
    return false;
  }
};

/**
 * Main worker loop
 */
const startWorker = async () => {
  if (isRunning) {
    console.log('Worker is already running');
    return;
  }

  isRunning = true;
  shouldStop = false;
  console.log('Queue worker started');

  while (!shouldStop) {
    try {
      // Process document jobs
      const docJob = await redisQueue.popDocumentJob(5); // 5 second timeout
      if (docJob) {
        await processDocumentJob(docJob);
      }

      // Process feedback jobs
      const feedbackJob = await redisQueue.popFeedbackJob(1); // 1 second timeout
      if (feedbackJob) {
        await processFeedbackJob(feedbackJob);
      }

      // Process webhook jobs (if available)
      try {
        const webhookJob = await redisQueue.popWebhookJob(1);
        if (webhookJob) {
          await processWebhookJob(webhookJob);
        }
      } catch (error) {
        // Webhook queue might not be available, continue
      }

      // Small delay to prevent CPU spinning
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Worker error:', error);
      // Continue running even if there's an error
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  isRunning = false;
  console.log('Queue worker stopped');
};

/**
 * Stop worker
 */
const stopWorker = () => {
  shouldStop = true;
  console.log('Stopping queue worker...');
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down worker...');
  stopWorker();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down worker...');
  stopWorker();
  await prisma.$disconnect();
  process.exit(0);
});

// Export for use in server.js or as standalone script
export default {
  startWorker,
  stopWorker,
  isRunning: () => isRunning,
};

// If run directly, start the worker
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch(console.error);
}

