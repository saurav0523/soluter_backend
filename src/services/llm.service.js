import ollama from 'ollama';

const generateAnswer = async (question, context, similarExamples = []) => {
  try {
    // Read environment variables at runtime to ensure they're loaded
    const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL;
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL;

    // Validate required environment variables
    if (!OLLAMA_MODEL) {
      throw new Error('OLLAMA_MODEL environment variable is not set. Please set it in your .env file (e.g., OLLAMA_MODEL=llama2)');
    }
    let contextText;
    
    if (typeof context === 'string') {
      contextText = context;
    } else if (Array.isArray(context) && context.length > 0) {
      contextText = context
        .map((chunk, index) => `--- Context ${index + 1} (Relevance: ${((chunk.score || 0) * 100).toFixed(1)}%) ---\n${chunk.content || ''}`)
        .join('\n\n');
    } else {
      return 'No relevant context found to answer this question.';
    }

    const prompt = `You are an expert problem-solving assistant specializing in case studies and mathematical calculations.

YOUR TASK:
Solve the question below using the methodology and rules from the CONTEXT, but apply them ONLY to the specific data provided in the QUESTION.

CRITICAL RULES:
1. DATA SOURCE SEPARATION:
   - Extract ALL specific data (names, amounts, dates, percentages, quantities) ONLY from the QUESTION
   - Use CONTEXT ONLY for: formulas, rules, calculation methods, legal provisions, tax rates, exemptions
   - NEVER use example data from CONTEXT (like "Ramesh has ₹30,000" or "Company XYZ") - these are just examples
   - If CONTEXT shows an example with "Ramesh" but QUESTION asks about "Priya", use ONLY Priya's data from QUESTION

2. FOR CASE-BASED SCENARIOS:
   - Identify all entities mentioned in the QUESTION (persons, companies, transactions)
   - Extract all numerical values, dates, and conditions from the QUESTION
   - Apply the rules/methodology from CONTEXT to these specific entities
   - Show clear reasoning: "Based on [rule from context], for [entity from question]..."

3. FOR MATHEMATICAL QUESTIONS:
   - Identify the formula/method from CONTEXT
   - Extract all numbers and variables from the QUESTION
   - Show step-by-step calculation:
     Step 1: Identify formula → [formula from context]
     Step 2: Extract values → [values from question]
     Step 3: Substitute → [calculation]
     Step 4: Result → [final answer]
   - Double-check arithmetic and ensure units are correct

4. ANSWER STRUCTURE:
   - Start with: "Based on the provided context, here's the solution:"
   - List all data extracted from QUESTION
   - Reference relevant rules/formulas from CONTEXT
   - Show complete step-by-step work
   - Provide final answer clearly
   - If data is missing, state: "The following information is missing: [list]"

5. IF ANSWER NOT IN CONTEXT:
   Reply exactly: "I cannot find this information in the uploaded document."

${similarExamples.length > 0 ? `\nLEARNING FROM SIMILAR QUESTIONS (Use these as reference for approach, but use ONLY the current question's data):
${similarExamples.map((ex, idx) => `
Example ${idx + 1} (Quality: ${(ex.qualityScore * 100).toFixed(0)}%, Used ${ex.usageCount} times):
Question: ${ex.question}
Answer Approach: ${ex.answer.substring(0, 300)}${ex.answer.length > 300 ? '...' : ''}
`).join('\n')}
` : ''}

CONTEXT (Rules, Formulas, Methods):
${contextText}

QUESTION (Extract data from here):
${question}

Now solve this problem step-by-step:`;

    const response = await ollama.generate({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        host: OLLAMA_BASE_URL,
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 1500, // Reduced from 2000 for faster generation
        top_k: 30,
        repeat_penalty: 1.1,
        num_ctx: 4096
      }
    });

    return response.response || 'Unable to generate answer.';
  } catch (error) {
    // Provide helpful error messages for common issues
    if (error.message && error.message.includes('not found')) {
      throw new Error(`LLM model '${process.env.OLLAMA_MODEL}' not found. Please ensure Ollama is running and the model is installed. Run: ollama pull ${process.env.OLLAMA_MODEL}`);
    }
    if (error.message && error.message.includes('connection')) {
      throw new Error(`Cannot connect to Ollama at ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}. Make sure Ollama is running: ollama serve`);
    }
    throw new Error(`LLM answer generation failed: ${error.message}`);
  }
};

export default {
  generateAnswer,
};

