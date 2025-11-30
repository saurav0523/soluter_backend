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

    // Batch insert chunks using transaction for better performance
    const BATCH_SIZE = 50;
    
    // Use transaction for atomicity and better performance
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);
        
        // Build batch insert query - filter out chunks without embeddings
        const insertPromises = batch.map((chunk, idx) => {
          const embedding = batchEmbeddings[idx];
          
          // Skip if embedding is missing or invalid
          if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
            console.warn(`Skipping chunk ${i + idx}: embedding is missing or invalid`);
            return null;
          }

          const embeddingString = `[${embedding.join(',')}]`;
          return tx.$executeRawUnsafe(
            `INSERT INTO "Chunk" (id, "documentId", content, embedding, "chunkIndex", "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3::vector(768), $4, NOW())`,
            document.id,
            chunk,
            embeddingString,
            i + idx
          );
        }).filter(promise => promise !== null); // Remove null promises
        
        // Execute batch in parallel within transaction
        if (insertPromises.length > 0) {
          await Promise.all(insertPromises);
        }
      }
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

