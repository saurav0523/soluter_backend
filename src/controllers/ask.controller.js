import ragService from '../services/rag.service.js';
import llmService from '../services/llm.service.js';
import learningService from '../services/learning.service.js';
import embedService from '../services/embed.service.js';
import redisCache from '../services/redis-cache.service.js';
import prisma from '../config/db.js';
import confidenceUtil from '../utils/confidence.js';

const askQuestion = async (req, res, next) => {
  try {
    let { question, documentId } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // If documentId is not provided, use the latest uploaded document
    if (!documentId) {
      const latestDoc = await prisma.document.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      
      if (!latestDoc) {
        return res.status(404).json({ 
          error: 'No documents found. Please upload a document first.' 
        });
      }
      
      documentId = latestDoc.id;
    }

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

    const questionEmbedding = await embedService.generateEmbeddings([question]);
    
    const [similarCached, similarQueries] = await Promise.all([
      redisCache.findSimilarCachedResponse(
        questionEmbedding[0],
        documentId,
        0.85 // 85% similarity threshold
      ),
      learningService.findSimilarQueries(question, documentId, 1, questionEmbedding[0])
    ]);
    
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

    const [chunks, similarExamples] = await Promise.all([
      ragService.retrieveContext(question, documentId, { questionEmbedding: questionEmbedding[0] }),
      Promise.resolve(similarQueries.slice(0, 2)) // Use already fetched similar queries
    ]);

    const contextText = chunks
      .map((c, i) => `[Document: ${c.documentName || 'Unknown'} | Relevance: ${((c.score || 0) * 100).toFixed(1)}%]\n${c.content || ''}`)
      .join('\n\n---\n\n');

    const similarities = chunks.map(c => Number(c.score ?? 0));

    const { answer, modelUsed } = await llmService.generateAnswer(
      question,
      contextText,
      similarExamples,
      similarities,
    );

    const confidenceData = confidenceUtil.computeConfidence({
      similarities,
      answer,
      contextText
    });

    if (confidenceUtil.shouldRejectAnswer(confidenceData.confidence, answer)) {
      // Sort chunks by score (best first) and take top chunks
      const sortedChunks = [...chunks]
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 3); // Take top 3 best scoring chunks
      
      const bestChunks = sortedChunks.map(c => ({
        chunk: c.content,
        score: c.score,
        documentName: c.documentName,
      }));

      // Create a helpful answer using the best chunks
      let helpfulAnswer = 'I cannot find the exact answer to your question, but based on my analysis, here\'s some related information that might be helpful:\n\n';
      
      if (bestChunks.length > 0) {
        // Use the best chunk's content as the answer
        const bestChunkText = bestChunks[0].chunk;
        // Limit to reasonable length to avoid too long responses
        helpfulAnswer += bestChunkText.length > 800 
          ? bestChunkText.substring(0, 800) + '...' 
          : bestChunkText;
      } else {
        helpfulAnswer += 'No relevant information found in the document.';
      }

      return res.json({
        question,
        answer: helpfulAnswer,
        queryId: null,
        answerId: null,
        context: bestChunks,
        confidence: confidenceData.confidence,
        confidenceLevel: confidenceData.level,
        confidenceDetail: confidenceData.detail,
        modelUsed: modelUsed || null,
        rejected: true,
        learningEnabled: true,
      });
    }

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
      confidence: confidenceData.confidence,
      confidenceLevel: confidenceData.level,
      confidenceDetail: confidenceData.detail,
      learningEnabled: true,
      modelUsed: modelUsed || null,
    };

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

