import Tesseract from 'tesseract.js';
import { createWorker } from 'tesseract.js';

// Optimized OCR with worker pool and better configuration
let workerPool = [];
const WORKER_POOL_SIZE = 2; // Reuse workers for better performance

const getWorker = async () => {
  if (workerPool.length > 0) {
    return workerPool.pop();
  }
  
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      // Only log errors and completion
      if (m.status === 'recognizing text' && m.progress === 1) {
        console.log('OCR completed');
      }
    },
  });
  
  // Optimize OCR settings for better performance
  await worker.setParameters({
    tessedit_pageseg_mode: '1', // Automatic page segmentation
    tessedit_char_whitelist: '', // Allow all characters
  });
  
  return worker;
};

const returnWorker = (worker) => {
  if (workerPool.length < WORKER_POOL_SIZE) {
    workerPool.push(worker);
  } else {
    worker.terminate();
  }
};

const extractText = async (filePath) => {
  let worker = null;
  try {
    worker = await getWorker();
    const { data: { text } } = await worker.recognize(filePath, {
      rectangle: null, // Process entire image
    });
    
    returnWorker(worker);
    return text;
  } catch (error) {
    if (worker) {
      try {
        worker.terminate();
      } catch (e) {
        // Ignore termination errors
      }
    }
    throw new Error(`OCR extraction failed: ${error.message}`);
  }
};

// Cleanup workers on process exit
process.on('beforeExit', async () => {
  for (const worker of workerPool) {
    try {
      await worker.terminate();
    } catch (e) {
      // Ignore errors
    }
  }
  workerPool = [];
});

export default {
  extractText,
};

