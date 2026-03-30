import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');
const backendEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: rootEnvPath });
dotenv.config({ path: backendEnvPath });

let s3Client = null;
let bucketName = null;
let useCloudStorage = false;

const initializeS3Storage = () => {
  const hasAccessKey = !!process.env.AWS_S3_ACCESS_KEY_ID;
  const hasSecretKey = !!process.env.AWS_S3_SECRET_ACCESS_KEY;
  const hasBucket = !!process.env.AWS_S3_BUCKET_NAME;
  const hasRegion = !!process.env.AWS_S3_REGION;
  const hasEndpoint = !!process.env.AWS_S3_ENDPOINT;

  if (!hasAccessKey || !hasSecretKey || !hasBucket || !hasRegion) {
    return;
  }

  try {
    const config = {
      region: process.env.AWS_S3_REGION,
      credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
      },
    };

    if (hasEndpoint) {
      config.endpoint = process.env.AWS_S3_ENDPOINT;
      config.forcePathStyle = true;
    }

    s3Client = new S3Client(config);
    bucketName = process.env.AWS_S3_BUCKET_NAME;
    useCloudStorage = true;
  } catch (error) {
    console.error('S3 initialization failed, using local storage:', error.message);
  }
};

initializeS3Storage();

export const uploadFile = async (filePath, fileName, documentId) => {
  try {
    if (useCloudStorage && s3Client) {
      const fileExtension = path.extname(fileName);
      const cloudFileName = `documents/${documentId}${fileExtension}`;

      const fileContent = await fs.readFile(filePath);

      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: cloudFileName,
        Body: fileContent,
        ContentType: getContentType(fileExtension),
        Metadata: {
          originalName: fileName,
          documentId: documentId,
        },
      }));

      const region = process.env.AWS_S3_REGION;
      const endpoint = process.env.AWS_S3_ENDPOINT;
      let s3Url;

      if (endpoint) {
        s3Url = `${endpoint}/${bucketName}/${cloudFileName}`;
      } else {
        s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${cloudFileName}`;
      }

      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore cleanup errors
      }

      return {
        filePath: s3Url,
        storageType: 's3',
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
    console.error('File upload to S3 failed:', error.message);
    return {
      filePath: filePath,
      storageType: 'local',
    };
  }
};

export const getFile = async (filePath, storageType = 'local') => {
  try {
    if (storageType === 's3' && s3Client) {
      const urlMatch = filePath.match(/\/([^/]+\/[^/]+)$/);

      if (urlMatch) {
        const key = urlMatch[1];

        const response = await s3Client.send(new GetObjectCommand({
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
    console.error('File download from S3 failed:', error);
    throw error;
  }
};

export const deleteFile = async (filePath, storageType = 'local') => {
  try {
    if (storageType === 's3' && s3Client) {
      const urlMatch = filePath.match(/\/([^/]+\/[^/]+)$/);
      if (urlMatch) {
        const key = urlMatch[1];
        await s3Client.send(new DeleteObjectCommand({
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
  return useCloudStorage && s3Client !== null;
};

export default {
  uploadFile,
  getFile,
  deleteFile,
  isCloudStorageEnabled,
};
