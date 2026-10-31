
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';

// Windows uses your existing standalone Piper installation.
// Linux uses the Piper executable installed inside Docker.
const IS_WINDOWS = process.platform === 'win32';

const PIPER_EXE =
  process.env.PIPER_EXE ||
  (IS_WINDOWS
    ? 'D:/piper-standalone/piper/piper.exe'
    : '/opt/piper-venv/bin/piper');

const PIPER_MODEL =
  process.env.PIPER_MODEL ||
  (IS_WINDOWS
    ? 'D:/tts-advanced/server/en_US-lessac-medium.onnx'
    : '/opt/piper-voices/en_US-lessac-medium.onnx');

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
    !['en-us', 'en_us'].includes(language.toLowerCase())
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
  if (
    !['en-us', 'en_us'].includes(language.toLowerCase())
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

  const safeRate = Math.min(2, Math.max(0.5, speakingRate || 1));
  const lengthScale = 1 / safeRate;

  // This Piper CLI does not support pitch adjustment.
  void pitch;

  await mkdir(config.audioDir, { recursive: true });

  const fileName = `${randomUUID()}.wav`;
  const filePath = path.join(config.audioDir, fileName);

  const args = [
    '--model',
    PIPER_MODEL,
    '--output_file',
    filePath,
    '--length_scale',
    String(lengthScale),
  ];

  // The standalone Windows Piper installation requires espeak-ng-data.
  if (IS_WINDOWS) {
    args.push('--espeak_data', PIPER_ESPEAK_DATA);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(PIPER_EXE, args, {
      windowsHide: true,
      stdio: ['pipe', 'ignore', 'pipe'],
    });

    let errorOutput = '';
    let settled = false;

    child.stderr.setEncoding('utf8');

    child.stderr.on('data', (chunk: string) => {
      errorOutput += chunk;
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;

      reject(
        new Error(
          `Could not start Piper. Check PIPER_EXE. ${error.message}`
        )
      );
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;

      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Piper speech generation failed (exit code ${code}). ${
              errorOutput.trim() ||
              'Check the Piper model and executable paths.'
            }`
          )
        );
      }
    });

    child.stdin.on('error', (error) => {
      if (!errorOutput) {
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
