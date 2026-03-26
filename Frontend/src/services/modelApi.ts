const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const DEFAULT_CHARACTER_ID = import.meta.env.VITE_CHARACTER_ID || 'default-character';

interface UploadVrmResponse {
  file?: {
    id?: number;
    characterId?: string;
    url?: string;
  };
}

export interface UploadedVrmModel {
  id: number;
  characterId: string;
  url: string;
}

interface ListedVrmModel {
  id: number;
  characterId: string;
  fileUrl: string;
}

interface ListVrmResponse {
  models?: ListedVrmModel[];
}

const toAbsoluteUrl = (urlPath: string): string => {
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
    return urlPath;
  }

  if (urlPath.startsWith('/')) {
    return `${API_BASE_URL}${urlPath}`;
  }

  return `${API_BASE_URL}/${urlPath}`;
};

export const uploadVrmFile = async (file: File, characterId = DEFAULT_CHARACTER_ID): Promise<UploadedVrmModel> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('characterId', characterId);

  const response = await fetch(`${API_BASE_URL}/api/v1/models/vrm/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload VRM failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as UploadVrmResponse;
  const modelId = data.file?.id;
  const responseCharacterId = data.file?.characterId;
  const urlPath = data.file?.url;
  if (!modelId || !responseCharacterId || !urlPath) {
    throw new Error('Upload succeeded but model metadata is missing in response.');
  }

  return {
    id: modelId,
    characterId: responseCharacterId,
    url: toAbsoluteUrl(urlPath),
  };
};

export const deleteVrmModelById = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/models/vrm/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Delete VRM failed (${response.status}): ${errorText}`);
  }
};

export const getLatestVrmModel = async (
  characterId = DEFAULT_CHARACTER_ID,
): Promise<UploadedVrmModel | null> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/models/vrm?characterId=${encodeURIComponent(characterId)}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Get VRM list failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ListVrmResponse;
  const latestModel = data.models?.[0];
  if (!latestModel) {
    return null;
  }

  return {
    id: latestModel.id,
    characterId: latestModel.characterId,
    url: toAbsoluteUrl(latestModel.fileUrl),
  };
};
