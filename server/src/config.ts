import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config();
export const config = {
  port: Number(process.env.PORT || 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'development-only-change-me-please-123456',
  maxTextLength: Number(process.env.MAX_TEXT_LENGTH || 5000),
  monthlyCharacterLimit: Number(process.env.MONTHLY_CHARACTER_LIMIT || 100000),
  audioDir: path.resolve(process.cwd(), 'audio'),
  uploadDir: path.resolve(process.cwd(), 'uploads'),
  openAiKey: process.env.OPENAI_API_KEY || ''
};
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Set JWT_SECRET to a random value of at least 32 characters in production.');
}
