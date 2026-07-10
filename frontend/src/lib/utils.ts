import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with clsx.
 * Handles conditional classes and deduplication.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats bytes into human-readable size string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Formats a duration in seconds to MM:SS or HH:MM:SS.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Extracts a YouTube video ID from various URL formats.
 */
export function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Resolves a thumbnail URL for a download based on its video type.
 */
export function getThumbnailUrl(
  videoType: string,
  url: string
): string | null {
  if (videoType === "youtube") {
    const id = getYouTubeId(url);
    if (id) return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  }
  return null;
}

/**
 * Returns the file extension from a filename.
 */
export function getFileExtension(filename: string | null): string {
  if (!filename) return "";
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

/**
 * Returns true if the file is a video type.
 */
export function isVideoFile(filename: string | null): boolean {
  const ext = getFileExtension(filename);
  return ["mp4", "webm", "mkv", "avi", "mov", "flv"].includes(ext);
}

/**
 * Returns true if the file is an audio type.
 */
export function isAudioFile(filename: string | null): boolean {
  const ext = getFileExtension(filename);
  return ["mp3", "m4a", "wav", "aac", "flac", "ogg", "wma"].includes(ext);
}

/**
 * Converts a raw format ID to a human-readable label.
 */
export function formatQuality(quality: string): string {
  if (quality.startsWith("dash-")) return "DASH";
  if (/^\d+$/.test(quality)) return `${quality}p`;
  if (quality.startsWith("sb-")) return "Storyboard";
  return quality;
}
