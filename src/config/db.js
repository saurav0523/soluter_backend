// Import env first to ensure environment variables are loaded
import './env.js';
import { PrismaClient } from '@prisma/client';
import { config } from './env.js';

// Enhanced Prisma client with connection pooling
const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: config.databaseUrl,
    },
  },
});

// Connection pooling configuration
prisma.$connect()
  .then(async () => {
    console.log('Database connected successfully');
    
    // Create vector indexes for performance (if not exists)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS chunk_embedding_idx 
        ON "Chunk" USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `);
      
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS query_embedding_idx 
        ON "Query" USING ivfflat ("questionEmbedding" vector_cosine_ops)
        WITH (lists = 100);
      `);
      
      console.log('Vector indexes created/verified');
    } catch (error) {
      // Indexes might already exist or pgvector version might use HNSW
      console.log('Note: Vector indexes setup -', error.message);
    }
  })
  .catch((error) => {
    console.error('Database connection error:', error);
    process.exit(1);
  });

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;

