import express from 'express';
import docController from '../controllers/doc.controller.js';

const router = express.Router();

router.get('/', docController.getAllDocs);
router.get('/:id', docController.getDocById);

export default router;

