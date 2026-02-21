const API_BASE = "/api/v1";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || res.statusText);
  }

  return res.json();
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  mimeType: string | null;
  hasThumbnail?: boolean;
}

export interface DirectoryListing {
  entries: FileEntry[];
  path: string;
  volume: string;
}

export interface VolumeInfo {
  id: string;
  label: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
}

export const api = {
  listFiles(volume: string, path: string = ""): Promise<DirectoryListing> {
    return request(`/files/${volume}/${path}`);
  },

  deleteFile(volume: string, path: string): Promise<{ ok: boolean }> {
    return request(`/files/${volume}/${path}`, { method: "DELETE" });
  },

  moveFile(
    volume: string,
    path: string,
    destination: string,
  ): Promise<{ ok: boolean }> {
    return request(`/files/${volume}/${path}`, {
      method: "PATCH",
      body: JSON.stringify({ destination }),
    });
  },

  createDirectory(
    volume: string,
    parentPath: string,
    name: string,
  ): Promise<{ ok: boolean }> {
    return request(`/files/${volume}/${parentPath}`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  getVolumes(): Promise<{ volumes: VolumeInfo[] }> {
    return request("/volumes");
  },

  getDownloadUrl(volume: string, path: string): string {
    return `${API_BASE}/download/${volume}/${path}`;
  },
};
