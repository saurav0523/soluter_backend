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
 *           examples:
 *             basicQuestion:
 *               value:
 *                 question: "What is the main topic of this document?"
 *             scopedQuestion:
 *               value:
 *                 question: "What are the key findings?"
 *                 documentId: "doc-123"
 *     responses:
 *       200:
 *         description: Answer generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AskQuestionResponse'
 *             examples:
 *               successfulAnswer:
 *                 value:
 *                   question: "What is the main topic?"
 *                   answer: "The document discusses machine learning fundamentals..."
 *                   queryId: "query-123"
 *                   answerId: "answer-456"
 *                   context:
 *                     - chunk: "Machine learning is..."
 *                       score: 0.95
 *                       documentName: "ml-basics.pdf"
 *                   confidence: 0.92
 *                   confidenceLevel: "high"
 *                   learningEnabled: true
 *                   cached: false
 *                   modelUsed: "llama2"
 *               cachedAnswer:
 *                 value:
 *                   question: "What is the main topic?"
 *                   answer: "The document discusses machine learning..."
 *                   cached: true
 *                   similarity: 0.89
 *                   cachedQuestion: "What is this document about?"
 *               rejectedAnswer:
 *                 value:
 *                   question: "What is the weather today?"
 *                   answer: "I cannot find this information in the uploaded document."
 *                   rejected: true
 *                   confidence: 0.15
 *                   confidenceLevel: "low"
 *       400:
 *         description: Bad request - Question is required
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

