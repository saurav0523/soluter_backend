import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Soluter Backend API',
      version: '1.0.0',
      description: 'Backend API for document processing and RAG system. Upload documents and ask questions about them. Workflow: 1) Upload a document (POST /api/upload) to get a document ID, 2) Use that ID to ask questions (POST /api/ask).',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Production server',
      },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Document ID',
            },
            fileName: {
              type: 'string',
              description: 'Name of the uploaded file',
            },
            fileType: {
              type: 'string',
              enum: ['pdf', 'image', 'text'],
              description: 'Type of the file',
            },
            chunkCount: {
              type: 'integer',
              description: 'Number of chunks created from the document',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Document creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Document update timestamp',
            },
          },
        },
        DocumentUploadResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            document: {
              $ref: '#/components/schemas/Document',
            },
          },
        },
        DocumentsListResponse: {
          type: 'object',
          properties: {
            documents: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Document',
              },
            },
          },
        },
        Chunk: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            chunkIndex: {
              type: 'integer',
            },
            content: {
              type: 'string',
            },
          },
        },
        DocumentDetail: {
          allOf: [
            { $ref: '#/components/schemas/Document' },
            {
              type: 'object',
              properties: {
                chunks: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Chunk',
                  },
                },
              },
            },
          ],
        },
        AskQuestionRequest: {
          type: 'object',
          required: ['question'],
          properties: {
            question: {
              type: 'string',
              description: 'The question to ask about the document',
              example: 'What is the main topic of this document?',
            },
            documentId: {
              type: 'string',
              description: 'Optional document ID to scope the question to a specific document',
            },
          },
        },
        ContextChunk: {
          type: 'object',
          properties: {
            chunk: {
              type: 'string',
              description: 'The text content of the chunk',
            },
            score: {
              type: 'number',
              format: 'float',
              description: 'Relevance score of the chunk (0-1)',
            },
            documentName: {
              type: 'string',
              description: 'Name of the document containing this chunk',
            },
          },
        },
        AskQuestionResponse: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
            },
            answer: {
              type: 'string',
              description: 'The generated answer to the question',
            },
            queryId: {
              type: 'string',
              nullable: true,
              description: 'ID of the stored query',
            },
            answerId: {
              type: 'string',
              nullable: true,
              description: 'ID of the answer record',
            },
            context: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ContextChunk',
              },
              description: 'Relevant document chunks used to generate the answer',
            },
            confidence: {
              type: 'number',
              format: 'float',
              description: 'Confidence score (0-1)',
            },
            confidenceLevel: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Confidence level classification',
            },
            confidenceDetail: {
              type: 'object',
              description: 'Detailed confidence metrics',
            },
            learningEnabled: {
              type: 'boolean',
              description: 'Whether learning/feedback system is enabled',
            },
            cached: {
              type: 'boolean',
              description: 'Whether the answer was retrieved from cache',
            },
            similarity: {
              type: 'number',
              format: 'float',
              description: 'Similarity score if answer was retrieved from cache',
            },
            cachedQuestion: {
              type: 'string',
              description: 'Original question if answer was retrieved from cache',
            },
            source: {
              type: 'string',
              description: 'Source of the answer (e.g., "database", "cache")',
            },
            modelUsed: {
              type: 'string',
              nullable: true,
              description: 'LLM model used to generate the answer',
            },
            rejected: {
              type: 'boolean',
              description: 'Whether the answer was rejected due to low confidence',
            },
          },
        },
        FeedbackRequest: {
          type: 'object',
          required: ['queryId', 'rating', 'isHelpful'],
          properties: {
            queryId: {
              type: 'string',
              description: 'ID of the query to provide feedback for',
            },
            answerId: {
              type: 'string',
              nullable: true,
              description: 'ID of the answer to provide feedback for',
            },
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Rating from 1 to 5',
            },
            isHelpful: {
              type: 'boolean',
              description: 'Whether the answer was helpful',
            },
            correction: {
              type: 'string',
              nullable: true,
              description: 'Corrected answer if the provided answer was incorrect',
            },
            userNotes: {
              type: 'string',
              nullable: true,
              description: 'Additional notes or comments from the user',
            },
          },
        },
        FeedbackResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            message: {
              type: 'string',
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
  },
  apis: [
    path.join(__dirname, '../routes/upload.routes.js'),
    path.join(__dirname, '../routes/ask.routes.js'),
  ], // Paths to files containing OpenAPI definitions
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

