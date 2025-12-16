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
        try {
          extractedText = await pdfService.extractText(filePath);
        } catch (error) {
          // If PDF extraction fails, provide helpful error
          if (error.message.includes('image-based') || error.message.includes('scanned')) {
            return res.status(400).json({ 
              error: 'PDF appears to be image-based (scanned document). ' +
                     'Please ensure the PDF has selectable text, or convert PDF pages to images and upload them separately for OCR processing.',
              suggestion: 'For scanned PDFs, you can: 1) Use a PDF editor to add text layer, 2) Convert PDF to images and upload them, or 3) Use a tool to OCR the PDF first.'
            });
          }
          throw error;
        }
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


    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ 
        error: 'No text could be extracted from the document.',
        fileType: fileType,
        suggestion: fileType === 'pdf' 
          ? 'The PDF might be image-based. Try converting it to images or use a PDF with selectable text.'
          : 'Please ensure the document contains readable text.'
      });
    }

    const chunks = await chunkService.chunkText(extractedText);

    if (!chunks || chunks.length === 0) {
      return res.status(400).json({ 
        error: 'Document could not be chunked. The extracted text might be too short or invalid.',
        extractedTextLength: extractedText.length
      });
    }
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

    let embeddings;
    try {
      embeddings = await embedService.generateEmbeddings(chunks);
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }

    if (!embeddings || embeddings.length === 0) {
      console.error('No embeddings generated. Chunks count:', chunks.length);
      throw new Error('Failed to generate embeddings for document. All embedding attempts failed. Check server logs for details.');
    }

    const transactionTimeout = Math.max(60000, 60000 + Math.ceil(chunks.length / 10) * 3000);
    const BATCH_SIZE = 100;
    
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

