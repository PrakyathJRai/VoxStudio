import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { listVoices, synthesize } from '../services/tts';
const router = Router();
router.get('/voices', async (req, res, next) => { try { res.json({ voices: await listVoices(String(req.query.language || 'en-US')) }); } catch (e) { next(e); } });
router.post('/', requireAuth, async (req: any, res, next) => {
  try {
    const data = z.object({ text: z.string().trim().min(1).max(config.maxTextLength), language: z.string().min(2).max(20), voice: z.string().max(160).default(''), speakingRate: z.number().min(0.25).max(4).default(1), pitch: z.number().min(-20).max(20).default(0) }).parse(req.body);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const aggregate = await prisma.speechJob.aggregate({ where: { userId: req.user.id, createdAt: { gte: monthStart } }, _sum: { characterCount: true } });
    const used = aggregate._sum.characterCount || 0;
    if (used + data.text.length > config.monthlyCharacterLimit) return res.status(429).json({ error: 'Monthly character limit reached.' });
    // Verify voice exists for the selected language before generating speech.
    const voices = await listVoices(data.language);
    if (data.voice && !voices.some(v => v.name === data.voice)) return res.status(400).json({ error: 'Selected voice is not available for this language.' });
    const audio = await synthesize(data.text, data.language, data.voice, data.speakingRate, data.pitch);
    const job = await prisma.speechJob.create({ data: { userId: req.user.id, text: data.text, language: data.language, voice: data.voice || 'provider-default', audioPath: audio.fileName, characterCount: data.text.length, speakingRate: data.speakingRate, pitch: data.pitch } });
    res.status(201).json({ success: true, job: { id: job.id, audioUrl: audio.url, language: job.language, voice: job.voice, characterCount: job.characterCount, createdAt: job.createdAt }, usage: { used: used + data.text.length, limit: config.monthlyCharacterLimit } });
  } catch (e) { next(e); }
});
export default router;
