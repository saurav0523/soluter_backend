const HF_CHAT_URL = process.env.HF_CHAT_URL || 'https://router.huggingface.co/v1/chat/completions';
const HF_API_KEY = process.env.HF_API_KEY;
const HF_FAST_MODEL = process.env.HF_FAST_MODEL;       // e.g. Qwen/Qwen2.5-7B-Instruct
const HF_ACCURATE_MODEL = process.env.HF_ACCURATE_MODEL; // e.g. Qwen/Qwen2.5-14B-Instruct

const ensureEnv = () => {
  if (!HF_API_KEY) {
    throw new Error('HF_API_KEY is not set in environment (.env).');
  }
  if (!HF_FAST_MODEL || !HF_ACCURATE_MODEL) {
    throw new Error('HF_FAST_MODEL and HF_ACCURATE_MODEL must be set in .env.');
  }
};

const callHFChat = async (model, prompt) => {
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
    throw new Error(`HF Router error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message?.content;
  if (!choice) {
    throw new Error('HF Router returned empty response');
  }
  return choice.trim();
};

const buildPrompt = (contextText, question) => `
You are an expert problem-solving assistant. Apply methodologies, formulas, and rules from reference documents to solve problems across any domain (mathematics, science, law, finance, medicine, etc.).

UNIVERSAL PROBLEM-SOLVING FRAMEWORK:

1. UNDERSTAND THE DOMAIN & PROBLEM TYPE:
   - Mathematics: Identify formula, theorem, or method (e.g., trigonometry, algebra, geometry)
   - Science/Medical: Identify law, principle, or diagnostic criteria
   - Finance/Tax: Identify applicable sections, calculation methods, exemptions
   - Law/Legal: Identify relevant provisions, clauses, precedents
   - General: Identify the core concept or rule being tested

2. METHODOLOGY EXTRACTION (from CONTEXT):
   - Formulas & Equations (e.g., sin²θ + cos²θ = 1, E=mc²)
   - Rules & Laws (e.g., Newton's laws, tax sections)
   - Procedures & Methods (e.g., diagnostic steps, calculation procedures)
   - Definitions & Criteria (e.g., disease symptoms, legal definitions)
   - Conditions & Constraints (e.g., "only if", "provided that", limits)

3. DATA EXTRACTION (from QUESTION):
   - Identify GIVEN: What data is provided (numbers, names, values, conditions)
   - Identify REQUIRED: What needs to be calculated/found/proven
   - CRITICAL: Use ONLY the data from QUESTION, NOT from CONTEXT examples
   - Example: If CONTEXT has "sin 30° = 0.5" but QUESTION asks "sin 45°", find sin 45° formula

4. DISTINGUISH WHAT'S WHAT:
   - CONTEXT = Reference material (formulas, rules, examples with methodology)
   - QUESTION = New problem (different values, names, angles, amounts)
   - Apply CONTEXT's methodology to QUESTION's data
   - NEVER substitute CONTEXT's example values into your answer

5. STEP-BY-STEP SOLUTION:
   Step 1: State the applicable rule/formula/method from CONTEXT
   Step 2: List all given data from QUESTION
   Step 3: Apply the rule/formula using QUESTION's specific values
   Step 4: Show intermediate calculations clearly
   Step 5: State the final answer with proper units/format

6. DOMAIN-SPECIFIC ACCURACY:
   - Mathematics: Show all substitutions, use correct notation (°, rad, √)
   - Finance/Tax: Distinguish income vs deduction, show gross → net calculation
   - Medical: List symptoms from question, match to diagnostic criteria from context
   - Legal: Cite specific sections/clauses, apply to question's scenario
   - Always maintain precision (decimal places, units, currency)

7. WHEN TO SAY "CANNOT FIND":
   - ONLY if CONTEXT completely lacks the required formula/rule/method
   - NOT if CONTEXT has similar problems with different values
   - Example: Can solve "Find sin 60°" if CONTEXT has trigonometric formulas, even if no sin 60° example

8. ANSWER FORMAT:
   - Start: "Based on [formula/rule/section] from the document..."
   - Show: Step-by-step with QUESTION's actual values
   - Label: Clearly mark "Given:", "Formula:", "Calculation:", "Answer:"
   - End: Final answer in proper format (with units, currency, or conclusion)

Context (Reference Material - Formulas, Rules, Methods, Examples):
${contextText}

Question (New Problem - Extract your data from here):
${question}

Now solve this step-by-step using the methodology from context and data from question:
`;

const shouldEscalateToAccurate = ({ similarities, answer, question }) => {
  if (!similarities || similarities.length === 0) {
    return false;
  }

  const avgScore = similarities.reduce((a, b) => a + b, 0) / similarities.length;

  const qLower = (question || '').toLowerCase();
  
  // Keywords that indicate need for higher accuracy
  const complexKeywords = [
    'calculate', 'computation', 'taxable', 'capital gain', 'income tax',
    'assessment year', 'deduction', 'exemption', 'financial year',
    'law', 'legal', 'compliance', 'penalty', 'fine', 'regulation',
    'section', 'act', 'clause', 'provision', 'amendment'
  ];

  const isComplex = complexKeywords.some(k => qLower.includes(k));

  // Escalate if:
  // 1. Low similarity (< 0.75)
  // 2. Answer indicates uncertainty
  // 3. Question involves complex calculations or legal matters
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

    // Step 1: fast path (7B)
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

    // Step 2: high-accuracy path (14B)
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

