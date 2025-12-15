
const STOP_WORDS = new Set([
  'the', 'and', 'with', 'from', 'that', 'this', 'have', 'will', 'would',
  'there', 'their', 'about', 'which', 'when', 'where', 'what', 'who',
  'how', 'why', 'been', 'being', 'were', 'was', 'are', 'has', 'had',
  'does', 'did', 'can', 'could', 'should', 'may', 'might', 'must',
  'shall', 'will', 'would', 'into', 'onto', 'over', 'under', 'through'
]);

/**
 * Calculate keyword overlap between answer and context
 * @param {string} answer - LLM generated answer
 * @param {string} contextText - Context used for generation
 * @returns {number} Overlap ratio (0-1)
 */
const keywordOverlap = (answer, contextText) => {
  if (!answer || !contextText) return 0;
  
  const words = answer
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 4 && !STOP_WORDS.has(w));
  
  const uniqueWords = [...new Set(words)];
  
  if (uniqueWords.length === 0) return 0;
  
  const contextLower = contextText.toLowerCase();
  const matchedWords = uniqueWords.filter(w => contextLower.includes(w));
  
  return matchedWords.length / uniqueWords.length;
};

/**
 * Compute confidence score for RAG answer
 * @param {Object} params
 * @param {number[]} params.similarities - Similarity scores of retrieved chunks
 * @param {string} params.answer - Generated answer
 * @param {string} params.contextText - Context text used for generation
 * @returns {Object} Confidence score and details
 */
const computeConfidence = ({ similarities = [], answer, contextText }) => {
  if (!similarities.length) {
    return {
      confidence: 0,
      level: 'none',
      rationale: 'No relevant context found',
      detail: { avgSim: 0, topSim: 0, coverage: 0, answerOverlap: 0 }
    };
  }

  const avgSim = similarities.reduce((a, b) => a + b, 0) / similarities.length;
  const topSim = Math.max(...similarities);
  const coverage = similarities.filter(s => s >= 0.78).length / similarities.length;
  const answerOverlap = keywordOverlap(answer, contextText);

  const rawScore = (
    0.4 * avgSim +
    0.2 * topSim +
    0.2 * coverage +
    0.2 * answerOverlap
  );

  const confidence = Math.max(0, Math.min(1, rawScore));

  let level;
  if (confidence >= 0.8) {
    level = 'high';
  } else if (confidence >= 0.6) {
    level = 'medium';
  } else if (confidence >= 0.4) {
    level = 'low';
  } else {
    level = 'very_low';
  }

  return {
    confidence: Number(confidence.toFixed(3)),
    level,
    detail: {
      avgSim: Number(avgSim.toFixed(3)),
      topSim: Number(topSim.toFixed(3)),
      coverage: Number(coverage.toFixed(3)),
      answerOverlap: Number(answerOverlap.toFixed(3))
    }
  };
};

/**
 * Check if answer should be rejected based on confidence
 * @param {number} confidence - Confidence score (0-1)
 * @param {string} answer - Generated answer
 * @returns {boolean} True if answer should be rejected
 */
const shouldRejectAnswer = (confidence, answer) => {
  if (confidence < 0.3) return true;
  
  const answerLower = answer.toLowerCase();
  
  const hasCalculation = /[\d,]+/.test(answer) || 
                        /step \d|calculate|formula|₹|rs\.|amount/.test(answerLower);
  
  if (hasCalculation) {
    return false;
  }
  
  const strictNotFoundPhrases = [
    'i cannot find this information',
    'information is not present',
    'document does not contain',
    'no information available'
  ];
  
  return strictNotFoundPhrases.some(phrase => answerLower.includes(phrase));
};

export default {
  computeConfidence,
  keywordOverlap,
  shouldRejectAnswer
};
