// Cloud Storage Service - Google Cloud Storage (GCS) for PDF/file storage
import { Storage } from '@google-cloud/storage';
import { config } from '../config/env.js';
import fs from 'fs/promises';
import path from 'path';

// Initialize GCS client (if credentials provided)
let storage = null;
let bucketName = null;
let useCloudStorage = false;

if (config.gcsBucketName && config.gcsCredentialsPath) {
  try {
    storage = new Storage({
      keyFilename: config.gcsCredentialsPath,
      projectId: config.gcsProjectId,
    });
    bucketName = config.gcsBucketName;
    useCloudStorage = true;
    console.log('Google Cloud Storage initialized');
  } catch (error) {
    console.warn('GCS initialization failed, using local storage:', error.message);
  }
}

/**
 * Upload file to cloud storage (GCS) or keep local
 */
export const uploadFile = async (filePath, fileName, documentId) => {
  try {
    if (useCloudStorage && storage) {
      // Upload to GCS
      const fileExtension = path.extname(fileName);
      const cloudFileName = `documents/${documentId}${fileExtension}`;
      
      await storage.bucket(bucketName).upload(filePath, {
        destination: cloudFileName,
        metadata: {
          contentType: getContentType(fileExtension),
          metadata: {
            originalName: fileName,
            documentId: documentId,
          },
        },
      });

      // Get public URL
      const publicUrl = `gs://${bucketName}/${cloudFileName}`;
      const httpsUrl = `https://storage.googleapis.com/${bucketName}/${cloudFileName}`;
      
      // Delete local file after upload
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn('Failed to delete local file:', error.message);
      }

      return {
        filePath: httpsUrl,
        storageType: 'gcs',
        bucket: bucketName,
        cloudPath: cloudFileName,
      };
    } else {
      // Use local storage
      return {
        filePath: filePath,
        storageType: 'local',
      };
    }
  } catch (error) {
    console.error('File upload to cloud storage failed:', error);
    // Fallback to local storage
    return {
      filePath: filePath,
      storageType: 'local',
    };
  }
};

/**
 * Download file from cloud storage or read local
 */
export const getFile = async (filePath, storageType = 'local') => {
  try {
    if (storageType === 'gcs' && storage) {
      // Extract bucket and file path from GCS URL
      const urlMatch = filePath.match(/gs:\/\/([^/]+)\/(.+)/) || 
                       filePath.match(/https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)/);
      
      if (urlMatch) {
        const bucket = urlMatch[1];
        const filePath = urlMatch[2];
        
        // Download to temp file
        const tempPath = `/tmp/${path.basename(filePath)}`;
        await storage.bucket(bucket).file(filePath).download({ destination: tempPath });
        
        return tempPath;
      }
    }
    
    // Local file or fallback
    return filePath;
  } catch (error) {
    console.error('File download from cloud storage failed:', error);
    throw error;
  }
};

/**
 * Delete file from cloud storage
 */
export const deleteFile = async (filePath, storageType = 'local') => {
  try {
    if (storageType === 'gcs' && storage) {
      const urlMatch = filePath.match(/gs:\/\/([^/]+)\/(.+)/) || 
                       filePath.match(/https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)/);
      
      if (urlMatch) {
        const bucket = urlMatch[1];
        const filePath = urlMatch[2];
        await storage.bucket(bucket).file(filePath).delete();
        return true;
      }
    } else {
      // Delete local file
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

/**
 * Get content type from file extension
 */
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

/**
 * Check if cloud storage is available
 */
export const isCloudStorageEnabled = () => {
  return useCloudStorage && storage !== null;
};

export default {
  uploadFile,
  getFile,
  deleteFile,
  isCloudStorageEnabled,
};

