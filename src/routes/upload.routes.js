import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import uploadController from '../controllers/upload.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760,
  },
});

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload a document for processing
 *     description: Uploads a PDF, image, or text file to be processed, chunked, embedded, and stored in the system
 *     tags:
 *       - Upload
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF, image (JPG, PNG), or text file to upload
 *     responses:
 *       200:
 *         description: Document uploaded and processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DocumentUploadResponse'
 *       400:
 *         description: Bad request - No file uploaded, unsupported file type, or processing error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               noFile:
 *                 value:
 *                   error: "No file uploaded"
 *               unsupportedType:
 *                 value:
 *                   error: "Unsupported file type"
 *               noTextExtracted:
 *                 value:
 *                   error: "No text could be extracted from the document."
 *                   fileType: "pdf"
 *                   suggestion: "The PDF might be image-based. Try converting it to images or use a PDF with selectable text."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', upload.single('file'), uploadController.uploadDocument);

export default router;

