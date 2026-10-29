
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';

const PIPER_EXE =
  process.env.PIPER_EXE ||
  'D:/piper-standalone/piper/piper.exe';

const PIPER_MODEL =
  process.env.PIPER_MODEL ||
  'D:/tts-advanced/server/en_US-lessac-medium.onnx';

const PIPER_ESPEAK_DATA =
  process.env.PIPER_ESPEAK_DATA ||
  'D:/piper-standalone/piper/espeak-ng-data';

const LOCAL_VOICE = {
  name: 'en_US-lessac-medium',
  languageCodes: ['en-US'],
  gender: 'NEUTRAL',
};

export async function listVoices(language?: string) {
  if (
    language &&
    language.toLowerCase() !== 'en-us' &&
    language.toLowerCase() !== 'en_us'
  ) {
    return [];
  }

  return [LOCAL_VOICE];
}

export async function synthesize(
  text: string,
  language: string,
  voice: string,
  speakingRate: number,
  pitch: number
) {
  // This installed Piper model currently supports US English.
  if (
    language.toLowerCase() !== 'en-us' &&
    language.toLowerCase() !== 'en_us'
  ) {
    throw new Error(
      'The local Piper model currently supports English (US) only. Please select English (US).'
    );
  }

  if (voice && voice !== LOCAL_VOICE.name) {
    throw new Error(
      'The selected voice is not installed. Please select the available local Piper voice.'
    );
  }

  if (!text.trim()) {
    throw new Error('Please enter some text to convert to speech.');
  }

  // Piper uses length_scale rather than a speaking-rate setting.
  // Smaller values speak faster; larger values speak slower.
  const safeRate = Math.min(2, Math.max(0.5, speakingRate || 1));
  const lengthScale = 1 / safeRate;

  // This Piper command-line version does not support pitch adjustment.
  void pitch;

  await mkdir(config.audioDir, { recursive: true });

  const fileName = `${randomUUID()}.wav`;
  const filePath = path.join(config.audioDir, fileName);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      PIPER_EXE,
      [
        '--model',
        PIPER_MODEL,
        '--output_file',
        filePath,
        '--espeak_data',
        PIPER_ESPEAK_DATA,
        '--length_scale',
        String(lengthScale),
      ],
      {
        windowsHide: true,
        stdio: ['pipe', 'ignore', 'pipe'],
      }
    );

    let errorOutput = '';

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      errorOutput += chunk;
    });

    child.on('error', (error) => {
      reject(
        new Error(
          `Could not start local Piper. Check PIPER_EXE. ${error.message}`
        )
      );
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Piper speech generation failed (exit code ${code}). ${
              errorOutput.trim() || 'Check the Piper model and executable paths.'
            }`
          )
        );
      }
    });

    child.stdin.on('error', (error) => {
      // The process close handler provides the final generation result.
      if (errorOutput.length === 0) {
        errorOutput = error.message;
      }
    });

    child.stdin.end(text);
  });

  const audioStats = await stat(filePath).catch(() => null);

  if (!audioStats || audioStats.size === 0) {
    throw new Error(
      'Piper finished without creating an audio file. Check the model and output paths.'
    );
  }

  return {
    fileName,
    filePath,
    url: `/api/audio/${fileName}`,
  };
}
