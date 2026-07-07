const API_BASE = "/api";

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

export async function addTorrent(data: TorrentAddRequest): Promise<Torrent> {
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
