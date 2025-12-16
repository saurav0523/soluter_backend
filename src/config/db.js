import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings for serverless databases (Neon, Supabase, etc.)
  // These help prevent connection timeouts
});

// Connection retry logic
const connectWithRetry = async (retries = 3, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('Database connected successfully');
      
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
        console.log('Note: Vector indexes setup -', error.message);
      }
      
      return;
    } catch (error) {
      console.error(`Database connection attempt ${i + 1}/${retries} failed:`, error.message);
      
      if (i < retries - 1) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        console.error('Database connection failed after all retries');
        throw error;
      }
    }
  }
};

// Handle connection errors
prisma.$on('error', (e) => {
  console.error('Prisma error:', e);
});

// Initialize connection
connectWithRetry()
  .catch((error) => {
    console.error('Database connection error:', error);
    if (error.message.includes('DATABASE_URL') || !process.env.DATABASE_URL) {
      console.error('Please check your DATABASE_URL in .env file');
    }
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Handle connection close and reconnect
const ensureConnection = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    if (error && typeof error === 'object' && 'kind' in error && error.kind === 'Closed') {
      console.log('Database connection closed, reconnecting...');
      try {
        await connectWithRetry(1, 1000);
      } catch (reconnectError) {
        console.error('Reconnection failed:', reconnectError.message);
      }
    }
  }
};

// Periodically check connection (every 30 seconds) - only in production
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    ensureConnection().catch(() => {
      // Ignore errors in background check
    });
  }, 30000);
}

export default prisma;

