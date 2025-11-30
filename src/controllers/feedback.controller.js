import learningService from '../services/learning.service.js';
import redisQueue from '../services/redis-queue.service.js';

const submitFeedback = async (req, res, next) => {
  try {
    const { queryId, answerId, rating, isHelpful, correction, userNotes } = req.body;

    if (!queryId) {
      return res.status(400).json({ error: 'queryId is required' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (typeof isHelpful !== 'boolean') {
      return res.status(400).json({ error: 'isHelpful must be a boolean' });
    }

    // Record feedback (synchronous - important for data integrity)
    await learningService.recordFeedback(
      queryId,
      answerId || null,
      rating,
      isHelpful,
      correction || null,
      userNotes || null
    );

    if (answerId) {
      await learningService.improveAnswerQuality(answerId);
    }

    // Push feedback processing job to queue (async analytics, webhooks, etc.)
    await redisQueue.pushFeedbackJob(queryId, answerId, {
      rating,
      isHelpful,
      correction,
      userNotes,
    });

    res.json({
      success: true,
      message: 'Feedback recorded successfully. The system will learn from this feedback.',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  submitFeedback,
};

