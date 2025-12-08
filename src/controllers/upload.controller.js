import pdfService from '../services/pdf.service.js';
import ocrService from '../services/ocr.service.js';
import chunkService from '../services/chunk.service.js';
import embedService from '../services/embed.service.js';
import graphService from '../services/graph.service.js';
import storageService from '../services/storage.service.js';
import { detectFileType } from '../utils/fileType.js';
import prisma from '../config/db.js';
import redisQueue from '../services/redis-queue.service.js';
import redisPubSub from '../services/redis-pubsub.service.js';

const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileType = detectFileType(fileName);

    let extractedText = '';

    switch (fileType) {
      case 'pdf':
        extractedText = await pdfService.extractText(filePath);
        break;
      case 'image':
        extractedText = await ocrService.extractText(filePath);
        break;
      case 'text':
        const fs = await import('fs/promises');
        extractedText = await fs.readFile(filePath, 'utf-8');
        break;
      default:
        return res.status(400).json({ error: 'Unsupported file type' });
    }

    const chunks = await chunkService.chunkText(extractedText);

    // Upload file to cloud storage (if configured) or keep local
    // We'll get document ID first, then upload
    const tempDocument = await prisma.document.create({
      data: {
        fileName,
        fileType,
        filePath, // Temporary local path
        text: extractedText,
        chunkCount: chunks.length,
      },
    });

    // Upload to cloud storage and get final file path
    const storageResult = await storageService.uploadFile(
      filePath,
      fileName,
      tempDocument.id
    );

    // Update document with final file path (cloud or local)
    const document = await prisma.document.update({
      where: { id: tempDocument.id },
      data: {
        filePath: storageResult.filePath,
      },
    });

    // Parallel processing: Generate embeddings
    const embeddings = await embedService.generateEmbeddings(chunks);

    // Validate embeddings
    if (!embeddings || embeddings.length === 0) {
      throw new Error('Failed to generate embeddings for document');
    }

    if (embeddings.length !== chunks.length) {
      console.warn(`Warning: Generated ${embeddings.length} embeddings for ${chunks.length} chunks. Some chunks may be missing embeddings.`);
    }

    // Batch insert chunks using optimized transaction
    // Calculate timeout based on number of chunks (minimum 30 seconds, +1 second per 10 chunks)
    const transactionTimeout = Math.max(30000, 30000 + Math.ceil(chunks.length / 10) * 1000);
    const BATCH_SIZE = 100; // Increased batch size for better performance
    
    // Use transaction with increased timeout for large documents
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);
        
        // Filter out chunks without valid embeddings and prepare for batch insert
        const validChunks = batch
          .map((chunk, idx) => ({
            chunk,
            embedding: batchEmbeddings[idx],
            index: i + idx
          }))
          .filter(item => item.embedding && Array.isArray(item.embedding) && item.embedding.length > 0);
        
        if (validChunks.length === 0) {
          continue;
        }
        
        // Use parallel inserts but with smaller concurrency to avoid overwhelming the database
        const CONCURRENT_INSERTS = 10; // Process 10 inserts at a time
        for (let j = 0; j < validChunks.length; j += CONCURRENT_INSERTS) {
          const concurrentBatch = validChunks.slice(j, j + CONCURRENT_INSERTS);
          
          const insertPromises = concurrentBatch.map((item) => {
            const embeddingString = `[${item.embedding.join(',')}]`;
            return tx.$executeRawUnsafe(
              `INSERT INTO "Chunk" (id, "documentId", content, embedding, "chunkIndex", "createdAt")
               VALUES (gen_random_uuid()::text, $1, $2, $3::vector(768), $4, NOW())`,
              document.id,
              item.chunk,
              embeddingString,
              item.index
            );
          });
          
          await Promise.all(insertPromises);
        }
      }
    }, {
      timeout: transactionTimeout,
      maxWait: transactionTimeout
    });

    // Build relationships in background (non-blocking)
    graphService.buildRelationships(document.id, chunks).catch(error => {
      console.error('Graph relationship building failed:', error);
    });

    // Publish document processed event
    await redisPubSub.publishDocumentProcessed(document.id, document.fileName, document.chunkCount);

    // Push to queue for async processing (analytics, notifications, etc.)
    await redisQueue.pushDocumentJob(document.id, document.fileName);

    res.json({
      success: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        fileType: document.fileType,
        chunkCount: document.chunkCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  uploadDocument,
};

