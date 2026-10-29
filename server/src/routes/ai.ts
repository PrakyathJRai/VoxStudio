import { Router } from 'express';
import OpenAI from 'openai';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { config } from '../config';
const router = Router();
router.post('/enhance', requireAuth, async (req, res, next) => {
  try {
    if (!config.openAiKey) return res.status(503).json({ error: 'AI enhancement is not configured. Add OPENAI_API_KEY to the server environment.' });
    const { text, style } = z.object({ text: z.string().trim().min(1).max(config.maxTextLength), style: z.enum(['conversational','clearer','summarize','grammar']).default('conversational') }).parse(req.body);
    const client = new OpenAI({ apiKey: config.openAiKey });
    const instructions: Record<string,string> = { conversational:'Rewrite the text so it sounds natural when spoken aloud. Preserve important facts.', clearer:'Rewrite the text for clarity and easy listening without changing its meaning.', summarize:'Summarize the text for spoken delivery while preserving the main points.', grammar:'Correct grammar and spelling while preserving the original meaning.' };
    const result = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role:'system', content: instructions[style] }, { role:'user', content:text }], temperature: 0.3 });
    res.json({ text: result.choices[0]?.message?.content?.trim() || text });
  } catch(e) { next(e); }
});
export default router;
