import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';

// Load environment variables before using them (in case this module loads before app.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Try both locations: root .env and backend/.env (backend/.env will override)
const rootEnvPath = path.resolve(__dirname, '../../.env');
const backendEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: rootEnvPath });
dotenv.config({ path: backendEnvPath }); // This will override root if both exist
  
let r2Client = null;
let bucketName = null;
let useCloudStorage = false;

// Initialize R2 Storage
const initializeR2Storage = () => {
  const hasAccessKey = !!process.env.R2_ACCESS_KEY_ID;
  const hasSecretKey = !!process.env.R2_SECRET_ACCESS_KEY;
  const hasBucket = !!process.env.R2_BUCKET_NAME;
  const hasEndpoint = !!process.env.R2_ENDPOINT;
  const hasAccountId = !!process.env.R2_ACCOUNT_ID;
  
  if (!hasAccessKey || !hasSecretKey || !hasBucket || (!hasEndpoint && !hasAccountId)) {
    return;
  }

  try {
    const endpoint = process.env.R2_ENDPOINT || 
                     `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    
    if (!endpoint || endpoint.includes('undefined')) {
      throw new Error('R2_ENDPOINT or R2_ACCOUNT_ID required');
    }

    r2Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    bucketName = process.env.R2_BUCKET_NAME;
    useCloudStorage = true;
  } catch (error) {
    console.error('R2 initialization failed, using local storage:', error.message);
  }
};

// Initialize on module load
initializeR2Storage();

export const uploadFile = async (filePath, fileName, documentId) => {
  try {
    if (useCloudStorage && r2Client) {
      const fileExtension = path.extname(fileName);
      const cloudFileName = `documents/${documentId}${fileExtension}`;
      
      const fileContent = await fs.readFile(filePath);
      
      await r2Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: cloudFileName,
        Body: fileContent,
        ContentType: getContentType(fileExtension),
        Metadata: {
          originalName: fileName,
          documentId: documentId,
        },
      }));

      const baseUrl = process.env.R2_ENDPOINT || 
                      `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      const r2Url = `${baseUrl}/${bucketName}/${cloudFileName}`;
      
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore cleanup errors
      }

      return {
        filePath: r2Url,
        storageType: 'r2',
        bucket: bucketName,
        cloudPath: cloudFileName,
      };
    } else {
      return {
        filePath: filePath,
        storageType: 'local',
      };
    }
  } catch (error) {
    console.error('File upload to R2 failed:', error.message);
    return {
      filePath: filePath,
      storageType: 'local',
    };
  }
};

export const getFile = async (filePath, storageType = 'local') => {
  try {
    if (storageType === 'r2' && r2Client) {
      const urlMatch = filePath.match(/\/([^/]+\/[^/]+)$/);
      
      if (urlMatch) {
        const key = urlMatch[1];
        
        const response = await r2Client.send(new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        }));
        
        const tempPath = `/tmp/${path.basename(key)}`;
        const fileContent = await response.Body.transformToByteArray();
        await fs.writeFile(tempPath, fileContent);
        
        return tempPath;
      }
    }
    
    return filePath;
  } catch (error) {
    console.error('File download from R2 failed:', error);
    throw error;
  }
};

export const deleteFile = async (filePath, storageType = 'local') => {
  try {
    if (storageType === 'r2' && r2Client) {
      const urlMatch = filePath.match(/\/([^/]+\/[^/]+)$/);
      
      if (urlMatch) {
        const key = urlMatch[1];
        await r2Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }));
        return true;
      }
    } else {
      try {
        await fs.unlink(filePath);
        return true;
      } catch (error) {
        return false;
      }
    }
  } catch (error) {
    console.error('File deletion failed:', error);
    return false;
  }
};

const getContentType = (extension) => {
  const contentTypes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
  };
  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
};
  
export const isCloudStorageEnabled = () => {
  return useCloudStorage && r2Client !== null;
};

export default {
  uploadFile,
  getFile,
  deleteFile,
  isCloudStorageEnabled,
};
