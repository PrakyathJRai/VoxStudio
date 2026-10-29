import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireAdmin } from '../middleware/auth';
const router = Router();
router.get('/metrics', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const [users, jobs, totalChars, recentJobs, popularLanguages] = await Promise.all([
      prisma.user.count(), prisma.speechJob.count(), prisma.speechJob.aggregate({ _sum: { characterCount: true } }),
      prisma.speechJob.findMany({ take: 10, orderBy: { createdAt:'desc' }, select: { id:true, language:true, characterCount:true, createdAt:true, user:{select:{email:true}} } }),
      prisma.speechJob.groupBy({ by:['language'], _count:{language:true}, orderBy:{_count:{language:'desc'}}, take:5 })
    ]);
    res.json({ users, jobs, charactersGenerated: totalChars._sum.characterCount || 0, recentJobs, popularLanguages });
  } catch(e) { next(e); }
});
export default router;
