import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

prisma.$connect()
  .then(async () => {
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
  })
  .catch((error) => {
    console.error('Database connection error:', error);
    process.exit(1);
  });

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;

