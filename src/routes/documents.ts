import { Router } from 'express';
import { createDocument, downloadDocument, listDocuments } from '../controllers/documentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', listDocuments);
router.post('/', createDocument);
router.get('/:id/download', downloadDocument);

export default router;
