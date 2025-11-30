import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { CHUNK_SIZE, CHUNK_OVERLAP } from '../utils/constants.js';

const chunkText = async (text) => {
  try {
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });

    const chunks = await textSplitter.splitText(text);
    return chunks.filter(chunk => chunk.trim().length > 0);
  } catch (error) {
    throw new Error(`Text chunking failed: ${error.message}`);
  }
};

export default {
  chunkText,
};

