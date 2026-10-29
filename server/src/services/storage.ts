
import path from 'node:path';
import { config } from '../config';

export function resolveAudioPath(fileName: string): string {
  // Accept only a UUID filename with a WAV extension.
  // This prevents directory traversal and arbitrary file access.
  const validWavName =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.wav$/i;

  if (!validWavName.test(fileName)) {
    throw new Error('Invalid audio file name.');
  }

  return path.join(config.audioDir, fileName);
}
