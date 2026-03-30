const HF_CHAT_URL = process.env.HF_CHAT_URL || 'https://router.huggingface.co/v1/chat/completions';
const HF_API_KEY = process.env.HF_CHAT_API_KEY || process.env.HF_API_KEY;
const HF_FAST_MODEL = process.env.HF_FAST_MODEL;
const HF_ACCURATE_MODEL = process.env.HF_ACCURATE_MODEL;

const ensureEnv = () => {
  if (!HF_API_KEY) {
    throw new Error('HF_CHAT_API_KEY is not set in environment (.env).');
  }
  if (!HF_FAST_MODEL || !HF_ACCURATE_MODEL) {
    throw new Error('HF_FAST_MODEL and HF_ACCURATE_MODEL must be set in .env.');
  }
};

const callHFChat = async (model, prompt) => {
  if (!HF_API_KEY) {
    throw new Error('HF_CHAT_API_KEY is not set. Please set it in your .env file.');
  }

  if (!HF_API_KEY.startsWith('hf_')) {
    console.warn('Warning: HF_CHAT_API_KEY should start with "hf_". Please verify your HuggingFace token.');
  }

  const res = await fetch(HF_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let errorMessage = `HF Router error (${res.status}): ${text}`;
    
    if (res.status === 401) {
      errorMessage = `HuggingFace authentication failed (401). Please check your HF_CHAT_API_KEY in .env file. ` +
                     `The token might be invalid, expired, or missing required permissions. ` +
                     `Get a new token from: https://huggingface.co/settings/tokens`;
    }
    
    throw new Error(errorMessage);
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message?.content;
  if (!choice) {
    throw new Error('HF Router returned empty response');
  }
  return choice.trim();
};

const buildPrompt = (contextText, question) => `
You are an expert problem-solving assistant. Apply methodologies, formulas, and rules from reference documents to solve problems or answer questions about the document content.

UNIVERSAL ANALYSIS & PROBLEM-SOLVING FRAMEWORK:

1. UNDERSTAND THE DOMAIN & QUESTION TYPE:
   - Mathematics/Science: Identify formula, theorem, or method
   - Finance/Tax/Legal: Identify applicable sections, calculation methods, or provisions
   - General/Overview: If asked about topics, summaries, or "what is this document about?", synthesize a high-level overview from the context.
   - Specific Inquiry: Find the exact information or data requested.

2. METHODOLOGY & DATA EXTRACTION (from CONTEXT):
   - Formulas, Rules & Procedures: (e.g., tax calculation steps, legal clauses)
   - Key Facts & Themes: For general questions, identify the recurring subjects or main purpose of the document.
   - Procedures: How things are done (e.g., "Timeline for backend is 10 days")
   - Constraints: "Only if", "provided that", limits.

3. DATA EXTRACTION (from QUESTION):
   - Identify what is specifically being asked (e.g., a calculation, a summary, a date).
   - Use data from the QUESTION to apply context methodologies.

4. LOGICAL SYNTHESIS:
   - For summary/topic questions: Combine the main points from the context chunks into a coherent answer.
   - For specific questions: Use the context logic to derive the answer based on the question's parameters.
   - NEVER use prior knowledge outside the provided context.

5. STEP-BY-STEP SOLUTION (for specific problems):
   Step 1: State the applicable rule/formula/fact from CONTEXT
   Step 2: List given data from QUESTION
   Step 3: Show the application/calculation
   Step 4: State final answer

6. WHEN TO SAY "CANNOT FIND":
   - ONLY if CONTEXT completely lacks the required information or methodology.
   - Be helpful: If the exact answer isn't there but related info is, provide the related info but clarify the exact answer was missing.

7. ANSWER FORMAT:
   - Start: "Based on the provided document..." or "Based on [specific section]..."
   - Structure: Use clear points or steps if applicable.
   - Conclusion: Provide a direct summary or value as the final result.

Context (Reference Material):
${contextText}

Question:
${question}

Provide a direct and helpful answer based ONLY on the context above:
`;

const shouldEscalateToAccurate = ({ similarities, answer, question }) => {
  if (!similarities || similarities.length === 0) {
    return false;
  }

  const avgScore = similarities.reduce((a, b) => a + b, 0) / similarities.length;

  const qLower = (question || '').toLowerCase();
  
  const complexKeywords = [
    'calculate', 'computation', 'taxable', 'capital gain', 'income tax',
    'assessment year', 'deduction', 'exemption', 'financial year',
    'law', 'legal', 'compliance', 'penalty', 'fine', 'regulation',
    'section', 'act', 'clause', 'provision', 'amendment'
  ];

  const isComplex = complexKeywords.some(k => qLower.includes(k));

  if (avgScore < 0.75) return true;
  if (answer && answer.includes('I cannot find')) return true;
  if (isComplex) return true;

  return false;
};

const generateAnswer = async (question, context, similarExamples = [], similarities = []) => {
  try {
    ensureEnv();

    let contextText;

    if (typeof context === 'string') {
      contextText = context;
    } else if (Array.isArray(context) && context.length > 0) {
      contextText = context
        .map((chunk, index) => `--- Context ${index + 1} (Relevance: ${((chunk.score || 0) * 100).toFixed(1)}%) ---\n${chunk.content || ''}`)
        .join('\n\n');
    } else {
      return {
        answer: 'No relevant context found to answer this question.',
        modelUsed: null,
      };
    }

    const prompt = buildPrompt(contextText, question);

    const fastAnswer = await callHFChat(HF_FAST_MODEL, prompt);

    const escalate = shouldEscalateToAccurate({
      similarities,
      answer: fastAnswer,
      question,
    });

    if (!escalate) {
      return {
        answer: fastAnswer,
        modelUsed: 'fast',
      };
    }

    const accurateAnswer = await callHFChat(HF_ACCURATE_MODEL, prompt);

    return {
      answer: accurateAnswer,
      modelUsed: 'accurate',
    };
  } catch (error) {
    throw new Error(`LLM answer generation failed: ${error.message}`);
  }
};

export default {
  generateAnswer,
};

