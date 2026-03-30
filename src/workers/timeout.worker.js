
import redisTimeout from '../services/redis-timeout.service.js';
import prisma from '../config/db.js';
import redisPubSub from '../services/redis-pubsub.service.js';

let isRunning = false;
let shouldStop = false;
const CHECK_INTERVAL = 30000;

const processExpiredQueries = async () => {
  try {
    const expiredQueryIds = await redisTimeout.getExpiredQueries();
    
    if (expiredQueryIds.length === 0) {
      return;
    }

    console.log(`Found ${expiredQueryIds.length} expired queries`);

    for (const queryId of expiredQueryIds) {
      try {
        await prisma.query.update({
          where: { id: queryId },
          data: {
          },
        });

        await redisTimeout.clearTimeout(queryId);

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
      
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    } catch (error) {
      console.error('Timeout worker error:', error);
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    }
  }

  isRunning = false;
  console.log('Timeout worker stopped');
};

const stopTimeoutWorker = () => {
  shouldStop = true;
  console.log('Stopping timeout worker...');
};

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
export default {
  startTimeoutWorker,
  stopTimeoutWorker,
  isRunning: () => isRunning,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  startTimeoutWorker().catch(console.error);
}

