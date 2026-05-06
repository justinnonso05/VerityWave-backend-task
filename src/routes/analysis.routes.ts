import { Router } from 'express';
import multer from 'multer';
import { AnalysisController } from '../controllers/analysis.controller.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Reject: Only images and videos are allowed.'));
    }
  }
});

router.post('/analyze', upload.single('file'), AnalysisController.analyze);
router.get('/history', AnalysisController.getHistory);

export default router;
