import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';
import { prisma } from './db';
import authRoutes from './routes/auth';
import ttsRoutes from './routes/tts';
import documentRoutes from './routes/documents';
import historyRoutes from './routes/history';
import aiRoutes from './routes/ai';
import adminRoutes from './routes/admin';
import { requireAuth } from './middleware/auth';
import { resolveAudioPath } from './services/storage';
const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: 'draft-7', legacyHeaders: false }));
app.get('/api/health', (_req,res) => res.json({ status:'ok', service:'text-to-speech-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.get('/api/audio/:fileName', requireAuth, async (req: any, res, next) => {
  try {
    const filePath = resolveAudioPath(req.params.fileName);
    // Only the owner of a job may stream its audio.
    const job = await prisma.speechJob.findFirst({ where: { userId: req.user.id, audioPath: req.params.fileName } });
    if (!job && req.user.role !== 'ADMIN') return res.status(404).json({ error:'Audio not found.' });
    res.setHeader('Content-Type', 'audio/wav');res.setHeader('Content-Disposition', 'inline; filename="speech.wav"');res.sendFile(filePath);
  } catch(e) { next(e); }
});
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.name === 'ZodError') return res.status(400).json({ error:'Invalid request data.', details: err.issues?.map((i:any)=>({path:i.path,message:i.message})) });
  if (err instanceof SyntaxError) return res.status(400).json({ error:'Malformed JSON request.' });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error:'File too large. Maximum upload size is 10 MB.' });
  if (err?.message?.includes('Only TXT')) return res.status(400).json({ error:err.message });
  console.error(err);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : (err?.message || 'Internal server error') });
});
async function start() {
  await mkdir(config.audioDir,{recursive:true}); await mkdir(config.uploadDir,{recursive:true});
  app.listen(config.port, () => console.log(`TTS API listening at http://localhost:${config.port}`));
}
start().catch(err => { console.error('Could not start API:',err); process.exit(1); });
