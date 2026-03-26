export type SpeakLanguage = 'vi' | 'en';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const DEFAULT_CHARACTER_ID = import.meta.env.VITE_CHARACTER_ID || 'default-character';

const normalizeLanguage = (language: string): SpeakLanguage => {
  const lowerLanguage = language.trim().toLowerCase();
  if (lowerLanguage.startsWith('vi')) {
    return 'vi';
  }

  return 'en';
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
};

export const sendToSpeak = async (text: string, language: string): Promise<ArrayBuffer> => {
  const normalizedLanguage = normalizeLanguage(language);
  const response = await fetch(`${API_BASE_URL}/api/v1/character/speak`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      characterId: DEFAULT_CHARACTER_ID,
      text,
      language: normalizedLanguage,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Speak API failed (${response.status}): ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json() as {
      audio?: { base64?: string };
      base64?: string;
    };

    const audioBase64 = json.audio?.base64 || json.base64;
    if (!audioBase64) {
      throw new Error('Speak API JSON response does not contain audio base64 data.');
    }

    return base64ToArrayBuffer(audioBase64);
  }

  return response.arrayBuffer();
};
