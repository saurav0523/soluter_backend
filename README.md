# Soluter Backend

Backend API for document processing and RAG (Retrieval-Augmented Generation) system with learning capabilities and Redis integration for performance and real-time updates.

## Features

- **Document Processing**
  - Document upload (PDF, Images, Text)
  - OCR processing for images using Tesseract.js
  - Text extraction from PDFs
  - Document chunking and embedding generation
  - Graph-RAG for relationship mapping between chunks

- **Question Answering**
  - RAG-based question answering using HuggingFace LLMs
  - Dual-model approach (fast model with automatic escalation to accurate model)
  - Semantic similarity search using vector embeddings
  - Confidence scoring and quality assessment

- **Learning System**
  - Query and answer storage for learning from interactions
  - Similar query matching using vector similarity
  - Quality scoring based on user feedback
  - Answer caching for frequently asked questions
  - Feedback collection and quality improvement

- **Performance & Real-time**
  - **Redis caching** for fast query responses (40-50x faster lookups)
  - **Redis queues** for async job processing
  - **Redis pub/sub** for real-time event notifications
  - **Redis timeouts** for query expiration management
  - **Background workers** for queue and timeout processing

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up database:
```bash
npx prisma generate
npx prisma migrate dev
```

4. Install and Start Redis:

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Windows:**
- Download Redis from: https://github.com/microsoftarchive/redis/releases
- Or use WSL2 and follow Ubuntu instructions
- Or use Chocolatey: `choco install redis-64`

**Verify Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

5. Start the server:
```bash
npm run dev
```

6. Start background workers (optional, in separate terminals):
```bash
# Queue worker (processes background jobs)
npm run worker

# Timeout worker (processes expired queries)
npm run worker:timeout
```

## API Endpoints

- `POST /api/upload` - Upload documents (PDF/Image/Text)
- `POST /api/ask` - Ask questions about uploaded documents
- `GET /api/docs` - Get all documents metadata
- `GET /api/docs/:id` - Get specific document by ID
- `POST /api/feedback` - Submit feedback for queries/answers
- `GET /health` - Health check endpoint
- `GET /api-docs` - Swagger API documentation

## Tech Stack

- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Vector Storage**: pgvector extension for semantic search
- **Caching & Queues**: Redis (ioredis)
- **LLM**: HuggingFace Inference API (dual-model: fast + accurate)
- **Embeddings**: Jina AI (cloud, default) - Ollama is optional fallback for local embeddings
- **OCR**: Tesseract.js
- **PDF Processing**: pdf-parse
- **API Documentation**: Swagger (swagger-jsdoc, swagger-ui-express)

## Redis Integration

This system uses Redis for:
- **Caching**: Query results, embeddings, learned answers (40-50x faster lookups)
- **Queues**: Async processing of documents, feedback, and background jobs
- **Pub/Sub**: Real-time event notifications (new queries, answer updates)
- **Timeouts**: Query expiration management (default: 600 seconds)

**Setup Redis locally** (no Docker required):
- macOS: `brew install redis && brew services start redis`
- Ubuntu: `sudo apt-get install redis-server && sudo systemctl start redis-server`

**Verify Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

## Database Schema

The system uses PostgreSQL with pgvector extension for vector similarity search:

- **Document**: Stores uploaded documents with metadata
- **Chunk**: Document chunks with vector embeddings
- **Relationship**: Graph relationships between chunks (Graph-RAG)
- **Query**: User queries with question embeddings
- **QueryAnswer**: Generated answers with quality scores
- **Feedback**: User feedback for continuous learning

## Environment Variables

Required environment variables (see `.env.example` for template):

- `DATABASE_URL` - PostgreSQL connection string with pgvector
- `REDIS_URL` - Redis connection URL
- `HF_CHAT_API_KEY` - HuggingFace API key for LLM (required)
- `HF_FAST_MODEL` - HuggingFace model for fast responses (required)
- `HF_ACCURATE_MODEL` - HuggingFace model for accurate responses (required)
- `USE_CLOUD_EMBEDDINGS` - Set to 'true' for Jina AI embeddings (default: 'true', requires `HF_API_KEY`)
- `HF_API_KEY` - Used for Jina AI embeddings when `USE_CLOUD_EMBEDDINGS=true` (required if using cloud embeddings)
- `OLLAMA_BASE_URL` - Optional: Ollama server URL (only if `USE_CLOUD_EMBEDDINGS=false` for local embeddings)
- `OLLAMA_EMBEDDING_MODEL` - Optional: Ollama embedding model name (only if using local embeddings)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

**Note**: The system uses HuggingFace for LLM generation. Ollama is only used as an optional fallback for embeddings if you set `USE_CLOUD_EMBEDDINGS=false`. By default, Jina AI (cloud) embeddings are used.

## Development

Run the development server:
```bash
npm run dev
```

Run Prisma Studio to view/edit database:
```bash
npm run prisma:studio
```

Generate Prisma client after schema changes:
```bash
npm run prisma:generate
```

