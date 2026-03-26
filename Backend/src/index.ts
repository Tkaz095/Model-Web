import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { Readable } from 'stream';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing. Please set it in Backend/.env or container environment.');
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const app = express();
const port = process.env.PORT || 10000;
const vrmUploadDir = path.resolve(process.cwd(), 'uploads', 'vrm');
const defaultCharacterId = process.env.DEFAULT_CHARACTER_ID || 'default-character';

if (!fs.existsSync(vrmUploadDir)) {
  fs.mkdirSync(vrmUploadDir, { recursive: true });
}

const vrmStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, vrmUploadDir);
  },
  filename: (_req, file, cb) => {
    const safeBaseName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const finalName = `${Date.now()}-${safeBaseName}.vrm`;
    cb(null, finalName);
  },
});

const vrmUpload = multer({
  storage: vrmStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isVrmExt = path.extname(file.originalname).toLowerCase() === '.vrm';
    if (!isVrmExt) {
      cb(new Error('Only .vrm files are allowed'));
      return;
    }

    cb(null, true);
  },
});

app.use(cors());
app.use(express.json());
app.use('/uploads/vrm', express.static(vrmUploadDir));

type Language = 'vi' | 'en';

interface SpeakRequestBody {
  characterId?: string;
  text?: string;
  language?: string;
}

interface UploadVrmBody {
  characterId?: string;
}

interface TtsResult {
  audioBase64: string;
  mimeType: string;
}

interface MouthOpenFrame {
  timeMs: number;
  mouthOpen: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const toNormalizedSpeed = (speed: number): number => clamp(speed, 0.5, 2);

const normalizeLanguage = (language: string): Language | null => {
  const lowerLanguage = language.trim().toLowerCase();
  if (lowerLanguage.startsWith('vi')) {
    return 'vi';
  }

  if (lowerLanguage.startsWith('en')) {
    return 'en';
  }

  return null;
};

const getDefaultVoiceByLanguage = (language: Language): string => {
  if (language === 'vi') {
    return process.env.DEFAULT_VOICE_VN || 'vi-VN-HoaiMyNeural';
  }

  return process.env.DEFAULT_VOICE_EN || 'en-US-GuyNeural';
};

const createSilenceWavBase64 = (durationMs: number): string => {
  const sampleRate = 16000;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = sampleCount * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer.toString('base64');
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer | Uint8Array | string) => {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(Buffer.from(chunk));
      }
    });

    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
};

const buildMouthOpenTimelineFromText = (text: string, speed: number): MouthOpenFrame[] => {
  const chars = text.trim().split('');
  const normalizedSpeed = toNormalizedSpeed(speed);
  const frameMs = Math.round(90 / normalizedSpeed);
  const result: MouthOpenFrame[] = [];

  let t = 0;
  for (const char of chars) {
    if (char.trim().length === 0) {
      t += frameMs;
      continue;
    }

    result.push({
      timeMs: t,
      mouthOpen: /[aeiouyăâêôơư]/i.test(char) ? 0.85 : 0.35,
    });
    t += frameMs;
  }

  if (result.length === 0) {
    return [{ timeMs: 0, mouthOpen: 0.1 }];
  }

  return result;
};

const formatRatePercent = (speed: number): string => {
  const ratePercent = Math.round((toNormalizedSpeed(speed) - 1) * 100);
  return `${ratePercent >= 0 ? '+' : ''}${ratePercent}%`;
};

const formatPitchHz = (pitch: number): string => {
  const pitchHz = Math.round((clamp(pitch, 0.5, 2) - 1) * 50);
  return `${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz`;
};

const synthesizeWithEdgeTts = async (input: {
  text: string;
  voiceName: string;
  pitch: number;
  speed: number;
}): Promise<TtsResult> => {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(input.voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const { audioStream } = await tts.toStream(input.text, {
    rate: toNormalizedSpeed(input.speed),
    pitch: formatPitchHz(input.pitch),
  });

  const audioBuffer = await streamToBuffer(audioStream);
  return {
    audioBase64: audioBuffer.toString('base64'),
    mimeType: 'audio/mpeg',
  };
};

const synthesizeSpeech = async (input: {
  provider: string;
  voiceName: string;
  pitch: number;
  speed: number;
  text: string;
}): Promise<TtsResult> => {
  if (process.env.TTS_MOCK_MODE === 'true') {
    return {
      audioBase64: createSilenceWavBase64(1500),
      mimeType: 'audio/wav',
    };
  }

  const provider = input.provider.toLowerCase();
  if (provider === 'edge-tts' || provider === 'openai') {
    return synthesizeWithEdgeTts({
      text: input.text,
      voiceName: input.voiceName,
      pitch: input.pitch,
      speed: input.speed,
    });
  }

  throw new Error(`Unsupported TTS provider: ${input.provider}`);
};

const safeDeleteFile = async (absoluteFilePath: string): Promise<void> => {
  try {
    await fs.promises.unlink(absoluteFilePath);
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;
    if (fileError.code !== 'ENOENT') {
      throw error;
    }
  }
};

app.get('/health', async (req, res) => {
  let dbConnected = false;

  try {
    // Simple query to check DB connection
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch (error) {
    console.error('Database connection error:', error);
  }

  return res.status(200).json({
    status: 'ok',
    service: 'backend',
    dbConnected,
  });
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/models/vrm/upload', vrmUpload.single('file'), async (req, res) => {
  try {
    const body = req.body as UploadVrmBody;
    const characterId = (body.characterId || defaultCharacterId).trim();

    if (!characterId) {
      return res.status(400).json({
        error: 'characterId is required',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Missing file. Use multipart/form-data with field name: file',
      });
    }

    const fileUrl = `/uploads/vrm/${req.file.filename}`;
    const savedModel = await prisma.vrmModel.create({
      data: {
        characterId,
        originalName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.path,
        fileUrl,
        mimeType: req.file.mimetype || 'application/octet-stream',
        size: req.file.size,
      },
    });

    return res.status(201).json({
      message: 'VRM file uploaded successfully',
      file: {
        id: savedModel.id,
        characterId: savedModel.characterId,
        originalName: req.file.originalname,
        fileName: req.file.filename,
        size: req.file.size,
        mimeType: req.file.mimetype,
        url: fileUrl,
      },
    });
  } catch (error) {
    console.error('Error in /api/v1/models/vrm/upload:', error);
    return res.status(500).json({
      error: 'Failed to upload VRM file',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/v1/models/vrm', async (req, res) => {
  try {
    const characterId = typeof req.query.characterId === 'string' ? req.query.characterId : undefined;
    const models = await prisma.vrmModel.findMany({
      where: characterId ? { characterId } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ models });
  } catch (error) {
    console.error('Error in GET /api/v1/models/vrm:', error);
    return res.status(500).json({
      error: 'Failed to fetch VRM models',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.delete('/api/v1/models/vrm/:id', async (req, res) => {
  const modelId = Number(req.params.id);
  if (!Number.isInteger(modelId) || modelId <= 0) {
    return res.status(400).json({
      error: 'Invalid model id',
    });
  }

  try {
    const model = await prisma.vrmModel.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      return res.status(404).json({
        error: `VRM model not found for id: ${modelId}`,
      });
    }

    await safeDeleteFile(model.filePath);
    await prisma.vrmModel.delete({
      where: { id: modelId },
    });

    return res.status(200).json({
      message: 'VRM model deleted successfully',
      id: modelId,
    });
  } catch (error) {
    console.error('Error in DELETE /api/v1/models/vrm/:id:', error);
    return res.status(500).json({
      error: 'Failed to delete VRM model',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/v1/character/speak', async (req, res) => {
  const body = req.body as SpeakRequestBody;

  if (!body.characterId || !body.text || !body.language) {
    return res.status(400).json({
      error: 'Missing required fields: characterId, text, language',
    });
  }

  const normalizedLanguage = normalizeLanguage(body.language);
  if (!normalizedLanguage) {
    return res.status(400).json({
      error: "Invalid language. Allowed values: 'vi' or 'en' (accepts vi-VN/en-US)",
    });
  }

  if (body.text.length > 4000) {
    return res.status(400).json({
      error: 'Text is too long. Maximum length is 4000 characters.',
    });
  }

  try {
    const config = await prisma.characterConfig.findUnique({
      where: { characterId: body.characterId },
    });

    const effectiveConfig = config
      ? config
      : {
          provider: 'edge-tts',
          voiceName: getDefaultVoiceByLanguage(normalizedLanguage),
          pitch: 1,
          speed: 1,
        };

    const voiceName = effectiveConfig.voiceName || getDefaultVoiceByLanguage(normalizedLanguage);
    const ttsResult = await synthesizeSpeech({
      provider: effectiveConfig.provider,
      voiceName,
      pitch: effectiveConfig.pitch,
      speed: effectiveConfig.speed,
      text: body.text,
    });

    const mouthOpenTimeline = buildMouthOpenTimelineFromText(body.text, effectiveConfig.speed);

    return res.status(200).json({
      characterId: body.characterId,
      language: normalizedLanguage,
      voiceConfig: {
        provider: effectiveConfig.provider,
        voiceName,
        pitch: effectiveConfig.pitch,
        speed: effectiveConfig.speed,
      },
      audio: {
        mimeType: ttsResult.mimeType,
        base64: ttsResult.audioBase64,
        streamUrl: null,
      },
      mouthOpenTimeline,
      lipSyncNote: 'Use frontend audio analyser for accurate mouthOpen from decoded audio waveform.',
    });
  } catch (error) {
    console.error('Error in /api/v1/character/speak:', error);
    return res.status(500).json({
      error: 'Failed to synthesize speech',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
