import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { CHUNK_SIZE, CHUNK_OVERLAP } from '../utils/constants.js';

const chunkText = async (text) => {
  try {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return [];
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });

    const chunks = await textSplitter.splitText(trimmedText);
    const validChunks = chunks.filter(chunk => chunk.trim().length > 0);
    if (validChunks.length === 0 && trimmedText.length > 0) {
      return [trimmedText];
    }

    return validChunks;
  } catch (error) {
    console.error('Text chunking error:', error);
    throw new Error(`Text chunking failed: ${error.message}`);
  }
};

export default {
  chunkText,
};

