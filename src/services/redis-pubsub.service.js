
import redis from '../config/redis.js';

const subscriber = redis.duplicate();
const publisher = redis.duplicate();

const CHANNEL_QUERY_NEW = 'query:new';
const CHANNEL_QUERY_UPDATED = 'query:updated';
const CHANNEL_ANSWER_UPDATED = 'answer:updated';
const CHANNEL_DOCUMENT_PROCESSED = 'document:processed';

export const publishNewQuery = async (queryId, question, documentId) => {
  try {
    const message = {
      queryId,
      question,
      documentId,
      timestamp: Date.now(),
    };
    await publisher.publish(CHANNEL_QUERY_NEW, JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('Redis publish new query error:', error);
    return false;
  }
};

export const publishQueryUpdated = async (queryId, status, answerId = null) => {
  try {
    const message = {
      queryId,
      status,
      answerId,
      timestamp: Date.now(),
    };
    await publisher.publish(CHANNEL_QUERY_UPDATED, JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('Redis publish query updated error:', error);
    return false;
  }
};

export const publishAnswerUpdated = async (answerId, qualityScore, queryId) => {
  try {
    const message = {
      answerId,
      qualityScore,
      queryId,
      timestamp: Date.now(),
    };
    await publisher.publish(CHANNEL_ANSWER_UPDATED, JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('Redis publish answer updated error:', error);
    return false;
  }
};

export const publishDocumentProcessed = async (documentId, fileName, chunkCount) => {
  try {
    const message = {
      documentId,
      fileName,
      chunkCount,
      timestamp: Date.now(),
    };
    await publisher.publish(CHANNEL_DOCUMENT_PROCESSED, JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('Redis publish document processed error:', error);
    return false;
  }
};

export const subscribeToNewQueries = (callback) => {
  subscriber.subscribe(CHANNEL_QUERY_NEW);
  subscriber.on('message', (channel, message) => {
    if (channel === CHANNEL_QUERY_NEW) {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        console.error('Error parsing new query message:', error);
      }
    }
  });
};

export const subscribeToQueryUpdates = (callback) => {
  subscriber.subscribe(CHANNEL_QUERY_UPDATED);
  subscriber.on('message', (channel, message) => {
    if (channel === CHANNEL_QUERY_UPDATED) {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        console.error('Error parsing query update message:', error);
      }
    }
  });
};

export const subscribeToAnswerUpdates = (callback) => {
  subscriber.subscribe(CHANNEL_ANSWER_UPDATED);
  subscriber.on('message', (channel, message) => {
    if (channel === CHANNEL_ANSWER_UPDATED) {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        console.error('Error parsing answer update message:', error);
      }
    }
  });
};

export const subscribeToDocumentProcessed = (callback) => {
  subscriber.subscribe(CHANNEL_DOCUMENT_PROCESSED);
  subscriber.on('message', (channel, message) => {
    if (channel === CHANNEL_DOCUMENT_PROCESSED) {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        console.error('Error parsing document processed message:', error);
      }
    }
  });
};

export const subscribeToAll = (callbacks) => {
  const channels = [
    CHANNEL_QUERY_NEW,
    CHANNEL_QUERY_UPDATED,
    CHANNEL_ANSWER_UPDATED,
    CHANNEL_DOCUMENT_PROCESSED,
  ];
  
  subscriber.subscribe(...channels);
  
  subscriber.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);
      
      switch (channel) {
        case CHANNEL_QUERY_NEW:
          if (callbacks.onNewQuery) callbacks.onNewQuery(data);
          break;
        case CHANNEL_QUERY_UPDATED:
          if (callbacks.onQueryUpdated) callbacks.onQueryUpdated(data);
          break;
        case CHANNEL_ANSWER_UPDATED:
          if (callbacks.onAnswerUpdated) callbacks.onAnswerUpdated(data);
          break;
        case CHANNEL_DOCUMENT_PROCESSED:
          if (callbacks.onDocumentProcessed) callbacks.onDocumentProcessed(data);
          break;
      }
    } catch (error) {
      console.error(`Error parsing message from ${channel}:`, error);
    }
  });
};

process.on('beforeExit', async () => {
  await subscriber.quit();
  await publisher.quit();
});

export default {
  publishNewQuery,
  publishQueryUpdated,
  publishAnswerUpdated,
  publishDocumentProcessed,
  subscribeToNewQueries,
  subscribeToQueryUpdates,
  subscribeToAnswerUpdates,
  subscribeToDocumentProcessed,
  subscribeToAll,
};

