import pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import storageService from './storage.service.js';

const extractText = async (filePath, storageType = 'local') => {
  try {
    const actualFilePath = storageType === 'r2' 
      ? await storageService.getFile(filePath, 'r2')
      : filePath;
    
    const dataBuffer = await fs.readFile(actualFilePath);
    const data = await pdfParse(dataBuffer);
    
    if (storageType === 'r2' && actualFilePath !== filePath) {
      try {
        await fs.unlink(actualFilePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    return data.text;
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
};

export default {
  extractText,
};

