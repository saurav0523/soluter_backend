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
    const tempDocument = await prisma.document.create({
      data: {
        fileName,
        fileType,
        filePath,
        text: extractedText,
        chunkCount: chunks.length,
      },
    });

    const storageResult = await storageService.uploadFile(
      filePath,
      fileName,
      tempDocument.id
    );

    const document = await prisma.document.update({
      where: { id: tempDocument.id },
      data: {
        filePath: storageResult.filePath,
      },
    });

    const embeddings = await embedService.generateEmbeddings(chunks);

    if (!embeddings || embeddings.length === 0) {
      throw new Error('Failed to generate embeddings for document');
    }

    if (embeddings.length !== chunks.length) {
      console.warn(`Warning: Generated ${embeddings.length} embeddings for ${chunks.length} chunks. Some chunks may be missing embeddings.`);
    }

    const transactionTimeout = Math.max(60000, 60000 + Math.ceil(chunks.length / 10) * 3000);
    const BATCH_SIZE = 100;
    
    console.log(`Inserting ${chunks.length} chunks with ${transactionTimeout}ms timeout`);
    
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);
        
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
        
        const CONCURRENT_INSERTS = 5;
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

    graphService.buildRelationships(document.id, chunks).catch(error => {
      console.error('Graph relationship building failed:', error);
    });
    
    await redisPubSub.publishDocumentProcessed(document.id, document.fileName, document.chunkCount);

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

