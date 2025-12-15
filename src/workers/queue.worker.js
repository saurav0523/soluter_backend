
import redisQueue from '../services/redis-queue.service.js';
import prisma from '../config/db.js';

let isRunning = false;
let shouldStop = false;


const processDocumentJob = async (job) => {
  try {
    console.log(`Processing document job: ${job.documentId} - ${job.fileName}`);    
    console.log(`[Webhook Simulation] Document ${job.fileName} processed successfully`);    
    return true;
  } catch (error) {
    console.error('Error processing document job:', error);
    return false;
  }
};

const processFeedbackJob = async (job) => {
  try {
    console.log(`Processing feedback job: Query ${job.queryId}, Answer ${job.answerId}`);
    
    console.log(`[Webhook Simulation] Feedback received for query ${job.queryId}:`, {
      rating: job.feedback.rating,
      isHelpful: job.feedback.isHelpful,
    });
    
    return true;
  } catch (error) {
    console.error('Error processing feedback job:', error);
    return false;
  }
};

const processWebhookJob = async (job) => {
  try {
    console.log(`[Webhook] ${job.event}:`, job.data);
    
    return true;
  } catch (error) {
    console.error('Error processing webhook job:', error);
    return false;
  }
};

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
      const docJob = await redisQueue.popDocumentJob(5); // 5 second timeout
      if (docJob) {
        await processDocumentJob(docJob);
      }

      const feedbackJob = await redisQueue.popFeedbackJob(1); // 1 second timeout
      if (feedbackJob) {
        await processFeedbackJob(feedbackJob);
      }

      try {
        const webhookJob = await redisQueue.popWebhookJob(1);
        if (webhookJob) {
          await processWebhookJob(webhookJob);
        }
      } catch (error) {
        // Webhook queue might not be available, continue
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  isRunning = false;
  console.log('Queue worker stopped');
};

const stopWorker = () => {
  shouldStop = true;
  console.log('Stopping queue worker...');
};

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

export default {
  startWorker,
  stopWorker,
  isRunning: () => isRunning,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch(console.error);
}

