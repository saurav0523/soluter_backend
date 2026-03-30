# Soluter Backend

Backend API for document processing and RAG (Retrieval-Augmented Generation) system with learning capabilities, Upstash Redis integration for performance and real-time updates, and AWS S3 for file storage.

## Features

- **Document Processing**
  - Document upload (PDF, Images, Text)
  - OCR processing for images using Tesseract.js
  - Text extraction from PDFs
  - Document chunking and embedding generation
  - Graph-RAG for relationship mapping between chunks
  - **File storage via AWS S3** (replaces Cloudflare R2)

- **Question Answering**
  - RAG-based question answering using HuggingFace LLMs
  - Dual-model approach (fast model with automatic escalation to accurate model)
  - Semantic similarity search using vector embeddings
  - Confidence scoring and quality assessment
  - **Task-specific embeddings** (`retrieval.query` for questions, `retrieval.passage` for chunks) for improved accuracy

- **Learning System**
  - Query and answer storage for learning from interactions
  - Similar query matching using vector similarity
  - Quality scoring based on user feedback
  - Answer caching for frequently asked questions
  - Feedback collection and quality improvement

- **Performance & Real-time**
  - **Upstash Redis REST** for fast caching (queries, embeddings, answers)
  - **Upstash Redis TCP (ioredis)** for Pub/Sub real-time event notifications and queues
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

4. **Redis via Upstash (no local Redis required)**:

This project uses **Upstash** as the Redis provider. No local Redis installation is needed.

- Go to [https://upstash.com](https://upstash.com) and create a free Redis database.
- Copy the **REST URL**, **REST Token**, and **TCP connection string** into your `.env`.

```env
UPSTASH_REDIS_REST_URL="https://<your-db>.upstash.io"
UPSTASH_REDIS_REST_TOKEN="<your-rest-token>"
REDIS_URL="rediss://default:<your-rest-token>@<your-db>.upstash.io:6379"
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

- `GET /` - Welcome page with links to docs and health check
- `POST /api/upload` - Upload documents (PDF/Image/Text)
- `POST /api/ask` - Ask questions about uploaded documents
- `GET /api/docs` - Get all documents metadata
- `GET /api/docs/:id` - Get specific document by ID
- `POST /api/feedback` - Submit feedback for queries/answers
- `GET /health` - Health check endpoint
- `GET /api-docs` - Swagger API documentation (interactive)

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Express.js |
| **Database** | PostgreSQL with Prisma ORM |
| **Vector Storage** | pgvector extension for semantic search |
| **Caching & Queues** | Upstash Redis (REST + TCP/ioredis hybrid) |
| **File Storage** | AWS S3 (`@aws-sdk/client-s3`) |
| **LLM** | HuggingFace Inference API (dual-model: fast + accurate) |
| **Embeddings** | Jina AI (`jina-embeddings-v3`, task-specific) |
| **OCR** | Tesseract.js |
| **PDF Processing** | pdf-parse |
| **API Documentation** | Swagger (swagger-jsdoc, swagger-ui-express) |

## Redis Integration (Upstash)

This system uses a **hybrid Upstash Redis** setup:

| Client | Protocol | Used For |
|---|---|---|
| `upstash` (REST) | HTTPS | Caching (queries, embeddings, answers) |
| `redis` (TCP/ioredis) | TLS | Pub/Sub, blocking queues, real-time events |

The REST client is more resilient and works behind serverless/cloud environments. The TCP client is retained because Pub/Sub and blocking operations (`BRPOP`) are not supported over REST.

**No local Redis installation required.** All Redis connections are routed to Upstash over the internet.

## File Storage (AWS S3)

Documents uploaded via `/api/upload` are stored in an **AWS S3 bucket**.

- Local temp files are cleaned up automatically after upload.
- The S3 URL is stored in the database for retrieval during PDF processing.
- Falls back to local storage if S3 credentials are not configured.

> **Note**: Ensure the IAM user has `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` permissions on the configured bucket.

## Database Schema

The system uses PostgreSQL with pgvector extension for vector similarity search:

- **Document**: Stores uploaded documents with metadata and S3 URLs
- **Chunk**: Document chunks with 768-dimensional vector embeddings
- **Relationship**: Graph relationships between chunks (Graph-RAG)
- **Query**: User queries with question embeddings
- **QueryAnswer**: Generated answers with quality scores
- **Feedback**: User feedback for continuous learning

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# HuggingFace (LLM)
HF_CHAT_API_KEY=hf_...
HF_CHAT_URL=https://router.huggingface.co/v1/chat/completions
HF_FAST_MODEL=Qwen/Qwen2.5-7B-Instruct
HF_ACCURATE_MODEL=Qwen/Qwen2.5-7B-Instruct

# Embeddings (Jina AI)
HF_API_KEY=jina_...          # Jina AI key (used for cloud embeddings)
USE_CLOUD_EMBEDDINGS=true    # Set false to use local Ollama embeddings

# Server
PORT=3000
NODE_ENV=production

# File Upload
MAX_FILE_SIZE=10485760       # 10 MB

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://<db>.upstash.io"
UPSTASH_REDIS_REST_TOKEN="<rest-token>"
REDIS_URL="rediss://default:<rest-token>@<db>.upstash.io:6379"

# AWS S3 Storage
AWS_S3_ACCESS_KEY_ID=...
AWS_S3_SECRET_ACCESS_KEY=...
AWS_S3_REGION=ap-south-1
AWS_S3_BUCKET_NAME=<your-bucket>
# AWS_S3_ENDPOINT=...        # Optional: only for custom S3-compatible endpoints

# Optional: Local Ollama (only if USE_CLOUD_EMBEDDINGS=false)
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

## Known Issues / Notes

- **Jina AI Rate Limit (429)**: The free tier of Jina AI limits to 2 concurrent embedding requests. If you upload large documents with many chunks, you may see `RATE_CONCURRENCY_LIMIT_EXCEEDED` warnings. This is expected — the system will successfully embed the remaining chunks on retry. Upgrade to a paid Jina AI plan to remove this limit.
- **S3 IAM Permissions**: Ensure your IAM user has `s3:PutObject` permission on the bucket. Without it, file uploads will fall back to local storage and S3 URLs will not be stored.

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

Apply database migrations:
```bash
npm run prisma:migrate
```
