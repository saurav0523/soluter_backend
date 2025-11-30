import ragService from '../services/rag.service.js';
import llmService from '../services/llm.service.js';
import learningService from '../services/learning.service.js';
import embedService from '../services/embed.service.js';
import redisCache from '../services/redis-cache.service.js';
import prisma from '../config/db.js';

const askQuestion = async (req, res, next) => {
  try {
    const { question, documentId } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Check for cached learned answer first (fast path - exact match)
    const cachedAnswer = await redisCache.getCachedLearnedAnswer(question);
    if (cachedAnswer && cachedAnswer.qualityScore >= 0.7) {
      return res.json({
        question,
        answer: cachedAnswer.answer,
        queryId: null,
        answerId: cachedAnswer.answerId,
        context: [],
        learningEnabled: true,
        cached: true,
      });
    }

    // Generate question embedding once (cached automatically)
    const questionEmbedding = await embedService.generateEmbeddings([question]);
    
    // Parallel: Check for similar cached response AND find similar queries in DB
    const [similarCached, similarQueries] = await Promise.all([
      redisCache.findSimilarCachedResponse(
        questionEmbedding[0],
        documentId,
        0.85 // 85% similarity threshold
      ),
      learningService.findSimilarQueries(question, documentId, 1, questionEmbedding[0])
    ]);
    
    // If we found a very similar cached response, use it
    if (similarCached && similarCached.similarity >= 0.85) {
      return res.json({
        question,
        answer: similarCached.answer,
        queryId: similarCached.queryId || null,
        answerId: similarCached.answerId || null,
        context: similarCached.context || [],
        learningEnabled: true,
        cached: true,
        similarity: similarCached.similarity,
        cachedQuestion: similarCached.cachedQuestion,
      });
    }
    
    // If we found a very similar query in DB with high quality answer, use it
    if (similarQueries.length > 0 && similarQueries[0].qualityScore >= 0.8) {
      return res.json({
        question,
        answer: similarQueries[0].answer,
        queryId: null,
        answerId: null,
        context: [],
        learningEnabled: true,
        cached: true,
        source: 'database',
      });
    }

    // Parallel operations: Retrieve context and get more similar examples
    const [chunks, similarExamples] = await Promise.all([
      ragService.retrieveContext(question, documentId, { questionEmbedding: questionEmbedding[0] }),
      Promise.resolve(similarQueries.slice(0, 2)) // Use already fetched similar queries
    ]);

    const contextText = chunks
      .map((c, i) => `[Document: ${c.documentName || 'Unknown'} | Relevance: ${((c.score || 0) * 100).toFixed(1)}%]\n${c.content || ''}`)
      .join('\n\n---\n\n');

    const answer = await llmService.generateAnswer(question, contextText, similarExamples);
    // Use the same embedding we generated earlier (avoid regenerating)
    const queryId = await learningService.storeQuery(question, answer, documentId, chunks, questionEmbedding[0]);
    const answerRecord = await prisma.queryAnswer.findFirst({
      where: { queryId },
      orderBy: { createdAt: 'desc' },
    });

    const response = {
      question,
      answer,
      queryId,
      answerId: answerRecord?.id || null,
      context: chunks.map(c => ({
        chunk: c.content,
        score: c.score,
        documentName: c.documentName,
      })),
      learningEnabled: true,
    };

    // Cache the complete response for similar future queries
    await redisCache.cacheResponse(
      question,
      questionEmbedding[0],
      response,
      documentId
    );

    res.json(response);
  } catch (error) {
    next(error);
  }
};

export default {
  askQuestion,
};

