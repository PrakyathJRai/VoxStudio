
import { Router } from 'express';
import multer from 'multer';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';

const router = Router();

const allowedMimeTypes = [
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error('Only TXT, PDF, and DOCX files are supported.')
      );
    }
  },
});

router.post(
  '/extract',
  requireAuth,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Choose a TXT, PDF, or DOCX file.',
        });
      }

      let text = '';

      if (req.file.mimetype === 'text/plain') {
        text = req.file.buffer.toString('utf8');
      } else if (req.file.mimetype === 'application/pdf') {
        const result = await pdfParse(req.file.buffer);
        text = result.text;
      } else if (
        req.file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const result = await mammoth.extractRawText({
          buffer: req.file.buffer,
        });
        text = result.value;
      }

      text = text.trim();

      if (!text) {
        return res.status(422).json({
          error: 'No readable text was found in the document.',
        });
      }

      const truncated = text.length > config.maxTextLength;

      if (truncated) {
        text = text.slice(0, config.maxTextLength);
      }

      return res.json({
        fileName: req.file.originalname,
        text,
        characterCount: text.length,
        truncated,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
