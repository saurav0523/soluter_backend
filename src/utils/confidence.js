
const STOP_WORDS = new Set([
  'the', 'and', 'with', 'from', 'that', 'this', 'have', 'will', 'would',
  'there', 'their', 'about', 'which', 'when', 'where', 'what', 'who',
  'how', 'why', 'been', 'being', 'were', 'was', 'are', 'has', 'had',
  'does', 'did', 'can', 'could', 'should', 'may', 'might', 'must',
  'shall', 'will', 'would', 'into', 'onto', 'over', 'under', 'through'
]);

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
  const coverage = similarities.filter(s => s >= 0.6).length / similarities.length;
  const answerOverlap = keywordOverlap(answer, contextText);

  const rawScore = (
    0.35 * avgSim +
    0.25 * topSim +
    0.15 * coverage +
    0.25 * answerOverlap
  );

  const confidence = Math.max(0, Math.min(1, rawScore));

  let level;
  if (confidence >= 0.7) {
    level = 'high';
  } else if (confidence >= 0.5) {
    level = 'medium';
  } else if (confidence >= 0.3) {
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

const shouldRejectAnswer = (confidence, answer) => {
  const answerLower = answer.toLowerCase();

  // If confidence is extremely low (< 0.22), we likely have nothing relevant
  if (confidence < 0.22) return true;
  
  const hasCalculation = /[\d,]+/.test(answer) || 
                        /step \d|calculate|formula|₹|rs\.|amount/.test(answerLower);
  
  if (hasCalculation) {
    return false;
  }
  
  const strictNotFoundPhrases = [
    'i cannot find this information',
    'information is not present',
    'document does not contain',
    'no information available',
    'not mentioned in the document',
    'context does not provide'
  ];
  
  return strictNotFoundPhrases.some(phrase => answerLower.includes(phrase));
};

export default {
  computeConfidence,
  keywordOverlap,
  shouldRejectAnswer
};
