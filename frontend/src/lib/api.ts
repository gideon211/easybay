const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface Download {
  id: number;
  url: string;
  video_type: string;
  quality: string;
  filename: string | null;
  status: "pending" | "downloading" | "paused" | "completed" | "failed";
  progress: number;
  speed: string | null;
  eta: string | null;
  error_message: string | null;
  file_size: number | null;
  remove_watermark: boolean;
  created_at: string | null;
  completed_at: string | null;
}

export interface DownloadRequest {
  url: string;
  quality?: string;
  remove_watermark?: boolean;
}

/**
 * Submit a new download request.
 */
export async function submitDownload(data: DownloadRequest): Promise<Download> {
  const response = await fetch(`${API_BASE}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to submit download");
  }
  return response.json();
}

/**
 * Fetch all downloads with optional pagination.
 */
export async function getDownloads(
  skip = 0,
  limit = 50
): Promise<Download[]> {
  const response = await fetch(
    `${API_BASE}/downloads?skip=${skip}&limit=${limit}`
  );
  if (!response.ok) throw new Error("Failed to fetch downloads");
  return response.json();
}

/**
 * Fetch a single download by ID.
 */
export async function getDownload(id: number): Promise<Download> {
  const response = await fetch(`${API_BASE}/downloads/${id}`);
  if (!response.ok) throw new Error("Download not found");
  return response.json();
}

/**
 * Get the file download URL for a download.
 */
export function getDownloadFileUrl(id: number): string {
  return `${API_BASE}/downloads/${id}/file`;
}

/**
 * Get the stream download URL (triggers browser save-to-device).
 */
export function getDownloadStreamUrl(id: number): string {
  return `${API_BASE}/downloads/${id}/stream`;
}

/**
 * Delete a download and its associated file.
 */
export async function deleteDownload(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/downloads/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete download");
}

/**
 * Pause an active download.
 */
export async function pauseDownload(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/downloads/${id}/pause`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to pause download");
}

/**
 * Resume a paused download.
 */
export async function resumeDownload(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/downloads/${id}/resume`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to resume download");
}

/**
 * Retry a failed download.
 */
export async function retryDownload(id: number): Promise<Download> {
  const response = await fetch(`${API_BASE}/downloads/${id}/retry`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to retry download");
  return response.json();
}

/**
 * Re-download an expired file (creates a new download entry).
 */
export async function reDownload(id: number): Promise<Download> {
  const response = await fetch(`${API_BASE}/downloads/${id}/re-download`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to re-download");
  return response.json();
}

/**
 * Clear all failed downloads.
 */
export async function clearFailedDownloads(): Promise<void> {
  const response = await fetch(`${API_BASE}/downloads/clear-failed`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to clear failed downloads");
}

export interface Torrent {
  id: number;
  magnet: string;
  name: string | null;
  info_hash: string | null;
  save_path: string | null;
  filename: string | null;
  status: string;
  progress: number;
  speed: string | null;
  eta: string | null;
  peers: number;
  total_size: number | null;
  downloaded: number | null;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export interface TorrentAddRequest {
  source: string;
  name?: string;
}

export async function addTorrent(data: TorrentAddRequest, file?: File): Promise<Torrent> {
  if (file) {
    const form = new FormData();
    form.append("source", data.source);
    if (data.name) form.append("name", data.name);
    form.append("file", file);
    const response = await fetch(`${API_BASE}/torrents`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to add torrent");
    }
    return response.json();
  }

  const response = await fetch(`${API_BASE}/torrents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to add torrent");
  }
  return response.json();
}

export async function getTorrents(
  skip = 0,
  limit = 50
): Promise<Torrent[]> {
  const response = await fetch(
    `${API_BASE}/torrents?skip=${skip}&limit=${limit}`
  );
  if (!response.ok) throw new Error("Failed to fetch torrents");
  return response.json();
}

export function getTorrentFileUrl(id: number): string {
  return `${API_BASE}/torrents/${id}/file`;
}

export async function deleteTorrent(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/torrents/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete torrent");
}

export async function removeBackground(file: File, outputFormat = "PNG"): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("output_format", outputFormat);
  const response = await fetch(`${API_BASE}/remove-bg`, { method: "POST", body: form });
  if (!response.ok) {
    let detail = "Background removal failed";
    try {
      const err = await response.json();
      detail = err.detail || detail;
    } catch {
      detail = `Background removal failed (${response.status} ${response.statusText})`;
    }
    throw new Error(detail);
  }
  return response.blob();
}

export async function convertToSvg(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE}/to-svg`, { method: "POST", body: form });
  if (!response.ok) {
    let detail = "SVG conversion failed";
    try {
      const err = await response.json();
      detail = err.detail || detail;
    } catch {
      detail = `SVG conversion failed (${response.status} ${response.statusText})`;
    }
    throw new Error(detail);
  }
  return response.blob();
}

export interface SystemStats {
  cpu_percent: number;
  ram_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  disk_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
}

export type SettingsMap = Record<string, string>;

export async function getSettings(): Promise<SettingsMap> {
  const response = await fetch(`${API_BASE}/settings`);
  if (!response.ok) throw new Error("Failed to fetch settings");
  return response.json();
}

export async function updateSettings(updates: Record<string, string>): Promise<SettingsMap> {
  const body = Object.entries(updates).map(([key, value]) => ({ key, value }));
  const response = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Failed to update settings");
  return response.json();
}

export async function getSystemStats(): Promise<SystemStats> {
  const response = await fetch(`${API_BASE}/system-stats`);
  if (!response.ok) throw new Error("Failed to fetch system stats");
  return response.json();
}
