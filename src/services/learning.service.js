import prisma from '../config/db.js';
import embedService from './embed.service.js';
import redisCache from './redis-cache.service.js';
import redisPubSub from './redis-pubsub.service.js';
import redisTimeout from './redis-timeout.service.js';

const formatEmbeddingForPG = (emb) => {
  return `[${emb.map(n => {
    if (!isFinite(n)) return '0.0';
    return Number(n).toString();
  }).join(',')}]`;
};

const storeQuery = async (question, answer, documentId, contextChunks, questionEmbedding = null) => {
  try {
    let qEmb;
    if (questionEmbedding) {
      qEmb = questionEmbedding;
    } else {
      const qEmbArray = await embedService.generateEmbeddings([question]);
      if (!qEmbArray || !qEmbArray[0]) throw new Error('Embedding generation failed');
      qEmb = qEmbArray[0];
    }
    
    const qVector = formatEmbeddingForPG(qEmb);
    const chunkIds = contextChunks.map(c => c.id || c);

    const queryResult = await prisma.$queryRawUnsafe(
      `INSERT INTO "Query" (id, question, "questionEmbedding", "documentId", "createdAt", "updatedAt")
       VALUES (
         gen_random_uuid()::text,
         $1,
         $2::vector(768),
         $3,
         NOW(),
         NOW()
       )
       RETURNING id`,
      question,
      qVector,
      documentId || null
    );

    if (!queryResult || queryResult.length === 0) {
      throw new Error('Failed to retrieve query ID');
    }

    const queryId = queryResult[0].id;

    const answerRecord = await prisma.queryAnswer.create({
      data: {
        queryId,
        answer,
        contextChunks: chunkIds,
        qualityScore: 0.5,
        usageCount: 1,
      },
    });

    await redisTimeout.setTimeout(queryId, 600);

    await redisPubSub.publishNewQuery(queryId, question, documentId);

    return queryId;
  } catch (error) {
    throw new Error(`Failed to store query: ${error.message}`);
  }
};

const findSimilarQueries = async (question, documentId = null, limit = 3, questionEmbedding = null) => {
  try {
    const cachedAnswer = await redisCache.getCachedLearnedAnswer(question);
    if (cachedAnswer && cachedAnswer.qualityScore >= 0.6) {
      return [{
        question,
        answer: cachedAnswer.answer,
        qualityScore: cachedAnswer.qualityScore,
        usageCount: 1,
      }];
    }

    let qEmb;
    if (questionEmbedding) {
      qEmb = questionEmbedding;
    } else {
      const qEmbArray = await embedService.generateEmbeddings([question]);
      if (!qEmbArray || !qEmbArray[0]) return [];
      qEmb = qEmbArray[0];
    }
    
    const qVector = formatEmbeddingForPG(qEmb);

    let sql;
    let params;

    if (documentId) {
      sql = `
        SELECT q.id, q.question, qa.id as "answerId", qa.answer, qa."qualityScore", qa."usageCount"
        FROM "Query" q
        JOIN "QueryAnswer" qa ON q.id = qa."queryId"
        WHERE q."documentId" = $2::text
        ORDER BY q."questionEmbedding" <-> $1::vector(768)
        LIMIT $3
      `;
      params = [qVector, documentId, limit];
    } else {
      sql = `
        SELECT q.id, q.question, qa.id as "answerId", qa.answer, qa."qualityScore", qa."usageCount"
        FROM "Query" q
        JOIN "QueryAnswer" qa ON q.id = qa."queryId"
        WHERE qa."qualityScore" >= 0.6 OR qa."usageCount" >= 2
        ORDER BY q."questionEmbedding" <-> $1::vector(768), qa."qualityScore" DESC, qa."usageCount" DESC
        LIMIT $2
      `;
      params = [qVector, limit];
    }

    const results = await prisma.$queryRawUnsafe(sql, ...params);
    
    const similarQueries = results.map(r => ({
      question: r.question,
      answer: r.answer,
      qualityScore: Number(r.qualityScore || 0),
      usageCount: Number(r.usageCount || 0),
    }));

    for (const sq of similarQueries) {
      if (sq.qualityScore >= 0.6) {
        await redisCache.cacheLearnedAnswer(sq.question, sq.answer, null, sq.qualityScore, documentId);
      }
    }

    return similarQueries;
  } catch (error) {
    console.error('Error finding similar queries:', error);
    return [];
  }
};

const recordFeedback = async (queryId, answerId, rating, isHelpful, correction = null, userNotes = null) => {
  try {
    await prisma.feedback.create({
      data: {
        queryId,
        answerId,
        rating,
        isHelpful,
        correction,
        userNotes,
      },
    });

    if (answerId) {
      const answer = await prisma.queryAnswer.findUnique({
        where: { id: answerId },
        include: {
          feedbacks: true,
        },
      });

      if (answer) {
        const feedbacks = answer.feedbacks;
        const helpfulCount = feedbacks.filter(f => f.isHelpful).length;
        const totalCount = feedbacks.length;
        const avgRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalCount;
        
        const qualityScore = (helpfulCount / totalCount) * 0.6 + (avgRating / 5) * 0.4;

        const updatedAnswer = await prisma.queryAnswer.update({
          where: { id: answerId },
          data: {
            qualityScore,
            usageCount: { increment: 1 },
          },
          include: {
            query: true,
          },
        });

        if (qualityScore >= 0.6 && updatedAnswer.query) {
          await redisCache.cacheLearnedAnswer(
            updatedAnswer.query.question,
            updatedAnswer.answer,
            answerId,
            qualityScore,
            updatedAnswer.query.documentId
          );
        }

        await redisPubSub.publishAnswerUpdated(answerId, qualityScore, queryId);
      }
    }
    
    await redisTimeout.clearTimeout(queryId);
  } catch (error) {
    throw new Error(`Failed to record feedback: ${error.message}`);
  }
};

const improveAnswerQuality = async (answerId) => {
  try {
    const answer = await prisma.queryAnswer.findUnique({
      where: { id: answerId },
      include: {
        feedbacks: true,
      },
    });

    if (!answer || answer.feedbacks.length === 0) return;

    const helpfulCount = answer.feedbacks.filter(f => f.isHelpful).length;
    const totalCount = answer.feedbacks.length;
    const avgRating = answer.feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalCount;
    
    const qualityScore = Math.min(1.0, (helpfulCount / totalCount) * 0.6 + (avgRating / 5) * 0.4);

    await prisma.queryAnswer.update({
      where: { id: answerId },
      data: {
        qualityScore,
      },
    });

    return qualityScore;
  } catch (error) {
    throw new Error(`Failed to improve answer quality: ${error.message}`);
  }
};

export default {
  storeQuery,
  findSimilarQueries,
  recordFeedback,
  improveAnswerQuality,
};

