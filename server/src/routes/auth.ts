import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db';
import { config } from '../config';
const router = Router();
const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) });
router.post('/register', async (req, res, next) => {
  try {
    const data = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email().max(254), password: z.string().min(8).max(128) }).parse(req.body);
    const email = data.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'An account with this email already exists.' });
    const user = await prisma.user.create({ data: { name: data.name, email, passwordHash: await bcrypt.hash(data.password, 12) } });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '1d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { next(e); }
});
router.post('/login', async (req, res, next) => {
  try {
    const data = credentials.parse(req.body); const email = data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { next(e); }
});
export default router;
