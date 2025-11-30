import express from 'express';
import askController from '../controllers/ask.controller.js';

const router = express.Router();

router.post('/', askController.askQuestion);

export default router;

