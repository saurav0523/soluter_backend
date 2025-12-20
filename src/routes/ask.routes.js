import express from 'express';
import askController from '../controllers/ask.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/ask:
 *   post:
 *     summary: Ask a question about uploaded documents
 *     description: |
 *       Sends a question to the RAG system to get an answer based on uploaded documents.
 *       If documentId is not provided, the system will automatically use the most recently uploaded document.
 *       The system will:
 *       - Search for similar cached answers first
 *       - Retrieve relevant document chunks using semantic search
 *       - Generate an answer using the LLM with retrieved context
 *       - Store the query for learning purposes
 *     tags:
 *       - Ask
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AskQuestionRequest'
 *           example:
 *             question: "What is the main topic of this document?"
 *     responses:
 *       200:
 *         description: Answer generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AskQuestionResponse'
 *             examples:
 *               successfulAnswer:
 *                 summary: Successful answer with high confidence
 *                 value:
 *                   question: "What is the main topic of this document?"
 *                   answer: "The document discusses machine learning fundamentals, including supervised and unsupervised learning algorithms, neural networks, and their practical applications in data science."
 *                   queryId: "550e8400-e29b-41d4-a716-446655440001"
 *                   answerId: "550e8400-e29b-41d4-a716-446655440002"
 *                   context:
 *                     - chunk: "Machine learning is a subset of artificial intelligence that enables systems to learn from data without being explicitly programmed. It includes various algorithms such as supervised learning, unsupervised learning, and reinforcement learning."
 *                       score: 0.95
 *                       documentName: "ml-basics.pdf"
 *                     - chunk: "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) organized in layers."
 *                       score: 0.88
 *                       documentName: "ml-basics.pdf"
 *                   confidence: 0.92
 *                   confidenceLevel: "high"
 *                   confidenceDetail:
 *                     avgSim: 0.915
 *                     topSim: 0.95
 *                     coverage: 0.85
 *                     answerOverlap: 0.92
 *                   learningEnabled: true
 *                   cached: false
 *                   modelUsed: "accurate"
 *               cachedAnswer:
 *                 summary: Answer retrieved from cache
 *                 value:
 *                   question: "What is machine learning?"
 *                   answer: "Machine learning is a subset of artificial intelligence that enables systems to learn from data without explicit programming."
 *                   cached: true
 *                   similarity: 0.89
 *                   cachedQuestion: "What is this document about?"
 *                   queryId: "550e8400-e29b-41d4-a716-446655440003"
 *                   answerId: "550e8400-e29b-41d4-a716-446655440004"
 *                   context:
 *                     - chunk: "Machine learning basics..."
 *                       score: 0.89
 *                       documentName: "ml-basics.pdf"
 *                   learningEnabled: true
 *               rejectedAnswer:
 *                 summary: Low confidence - shows best matching chunks
 *                 value:
 *                   question: "What is the weather today?"
 *                   answer: "I cannot find the exact answer to your question, but based on my analysis, here's some related information that might be helpful:\n\nDear Hiring Manager,\nI am writing to apply for the Financial Planning & Analysis (FP&A) Associate position at JPMorgan Chase & Co. JPMorgan Chase's status as one of the world's largest financial institutions..."
 *                   rejected: true
 *                   queryId: null
 *                   answerId: null
 *                   confidence: 0.24
 *                   confidenceLevel: "very_low"
 *                   confidenceDetail:
 *                     avgSim: 0.245
 *                     topSim: 0.262
 *                     coverage: 0.0
 *                     answerOverlap: 0.46
 *                   context:
 *                     - chunk: "analytical skills and dedication to your organization. Thank you for considering my application. I welcome the opportunity to discuss how I can add value to your team."
 *                       score: 0.26
 *                       documentName: "Cover letter for JPMC.pdf"
 *                     - chunk: "budgeting and forecasting process. Project & Portfolio Management: Managed large loan portfolios end-to-end..."
 *                       score: 0.23
 *                       documentName: "Cover letter for JPMC.pdf"
 *                   learningEnabled: true
 *                   modelUsed: "accurate"
 *       400:
 *         description: Bad request - Question is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No documents found - Please upload a document first
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', askController.askQuestion);

export default router;

