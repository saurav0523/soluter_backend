import pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import storageService from './storage.service.js';
import ocrService from './ocr.service.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimum text length to consider PDF as having extractable text
const MIN_TEXT_LENGTH = 10;

const extractText = async (filePath, storageType = 'local') => {
  let actualFilePath = filePath;
  let tempFiles = [];

  try {
    // Get file if from cloud storage
    if (storageType === 'r2') {
      actualFilePath = await storageService.getFile(filePath, 'r2');
      tempFiles.push(actualFilePath);
    }
    
    const dataBuffer = await fs.readFile(actualFilePath);
    const data = await pdfParse(dataBuffer);
    
    let extractedText = data.text || '';
    
    // If text is too short or empty, try OCR on PDF pages
    if (!extractedText || extractedText.trim().length < MIN_TEXT_LENGTH) {
      try {
        // If we have any text at all, return it
        if (extractedText && extractedText.trim().length > 0) {
          return extractedText.trim();
        }
        
        // If completely empty, throw error with helpful message
        throw new Error(
          'PDF appears to be image-based (scanned document). ' +
          'Text extraction returned empty. ' +
          'Please ensure the PDF has selectable text, or use an image file directly for OCR processing.'
        );
      } catch (ocrError) {
        // If OCR fails, return whatever text we have
        if (extractedText && extractedText.trim().length > 0) {
          return extractedText.trim();
        }
        throw ocrError;
      }
    }
    
    return extractedText.trim();
  } catch (error) {
    // Clean up temp files
    for (const tempFile of tempFiles) {
      try {
        if (tempFile !== filePath) {
          await fs.unlink(tempFile);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
};

export default {
  extractText,
};

