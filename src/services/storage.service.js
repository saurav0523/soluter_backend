
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
  
let r2Client = null;
let bucketName = null;
let useCloudStorage = false;

if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
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
    console.log('Cloudflare R2 Storage initialized');
  } catch (error) {
    console.warn('R2 initialization failed, using local storage:', error.message);
  }
}

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
        console.warn('Failed to delete local file:', error.message);
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
    console.error('File upload to R2 failed:', error);
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
        console.warn('Failed to delete local file:', error.message);
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
