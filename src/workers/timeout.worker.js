// Timeout worker for managing query timeouts
import redisTimeout from '../services/redis-timeout.service.js';
import prisma from '../config/db.js';
import redisPubSub from '../services/redis-pubsub.service.js';

let isRunning = false;
let shouldStop = false;
const CHECK_INTERVAL = 30000; // Check every 30 seconds

/**
 * Process expired queries
 */
const processExpiredQueries = async () => {
  try {
    const expiredQueryIds = await redisTimeout.getExpiredQueries();
    
    if (expiredQueryIds.length === 0) {
      return;
    }

    console.log(`Found ${expiredQueryIds.length} expired queries`);

    for (const queryId of expiredQueryIds) {
      try {
        // Mark query as unresolved in database
        await prisma.query.update({
          where: { id: queryId },
          data: {
            // You might want to add a status field to Query model
            // For now, we'll just log it
          },
        });

        // Remove from timeout set
        await redisTimeout.clearTimeout(queryId);

        // Publish timeout event
        await redisPubSub.publishQueryUpdated(queryId, 'timeout');

        console.log(`Query ${queryId} marked as timeout`);
      } catch (error) {
        console.error(`Error processing expired query ${queryId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing expired queries:', error);
  }
};

/**
 * Main timeout worker loop
 */
const startTimeoutWorker = async () => {
  if (isRunning) {
    console.log('Timeout worker is already running');
    return;
  }

  isRunning = true;
  shouldStop = false;
  console.log('Timeout worker started');

  while (!shouldStop) {
    try {
      await processExpiredQueries();
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    } catch (error) {
      console.error('Timeout worker error:', error);
      // Continue running even if there's an error
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    }
  }

  isRunning = false;
  console.log('Timeout worker stopped');
};

/**
 * Stop worker
 */
const stopTimeoutWorker = () => {
  shouldStop = true;
  console.log('Stopping timeout worker...');
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down timeout worker...');
  stopTimeoutWorker();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down timeout worker...');
  stopTimeoutWorker();
  await prisma.$disconnect();
  process.exit(0);
});

// Export for use in server.js or as standalone script
export default {
  startTimeoutWorker,
  stopTimeoutWorker,
  isRunning: () => isRunning,
};

// If run directly, start the worker
if (import.meta.url === `file://${process.argv[1]}`) {
  startTimeoutWorker().catch(console.error);
}

