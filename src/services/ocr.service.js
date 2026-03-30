import Tesseract from 'tesseract.js';
import { createWorker } from 'tesseract.js';

let workerPool = [];
const WORKER_POOL_SIZE = 2;

const getWorker = async () => {
  if (workerPool.length > 0) {
    return workerPool.pop();
  }

  const worker = await createWorker('eng', 1, {
    logger: () => { },
  });

  await worker.setParameters({
    tessedit_pageseg_mode: '1',
    tessedit_char_whitelist: '',
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
      rectangle: null,
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

