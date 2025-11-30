# Soluter Backend

Backend API for document processing and RAG (Retrieval-Augmented Generation) system with Redis integration for performance and real-time updates.

## Features

- Document upload (PDF, Images, Text)
- OCR processing for images
- Text extraction from PDFs
- Document chunking and embedding
- Graph-RAG for relationship mapping
- RAG-based question answering using Ollama
- **Redis caching** for fast query responses
- **Redis queues** for async job processing
- **Redis pub/sub** for real-time updates
- **Background workers** for queue processing

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
- `GET /api/docs` - Get document metadata

## Tech Stack

- Express.js
- Prisma + PostgreSQL
- **Redis** (caching, queues, pub/sub)
- Ollama (for LLM and embeddings)
- Tesseract.js (OCR)
- pdf-parse (PDF processing)

## Redis Integration

This system uses Redis for:
- **Caching**: Query results, embeddings, learned answers (40-50x faster lookups)
- **Queues**: Async processing of documents, feedback, webhooks
- **Pub/Sub**: Real-time event notifications
- **Timeouts**: Query timeout management

**Setup Redis locally** (no Docker required):
- macOS: `brew install redis && brew services start redis`
- Ubuntu: `sudo apt-get install redis-server && sudo systemctl start redis-server`
- See [SETUP_REDIS.md](./SETUP_REDIS.md) for detailed installation instructions

**Verify Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

