import type { Download, Torrent, SystemStats } from "@/lib/api";

interface StorageWidgetProps {
  downloads: Download[];
  torrents: Torrent[];
  systemStats: SystemStats | null;
}

const VIDEO_EXTS = new Set([".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".m4v", ".ts", ".mts"]);
const AUDIO_EXTS = new Set([".mp3", ".flac", ".wav", ".aac", ".ogg", ".wma", ".m4a", ".opus"]);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg", ".avif", ".heic"]);

function ext(filename: string | null): string {
  if (!filename) return "";
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

interface BreakdownItem {
  label: string;
  bytes: number;
  color: string;
}

function computeBreakdown(downloads: Download[], torrents: Torrent[]): BreakdownItem[] {
  const items: { ext: string; bytes: number }[] = [];

  for (const d of downloads) {
    if (d.file_size && d.status === "completed") {
      items.push({ ext: ext(d.filename), bytes: d.file_size });
    }
  }

  for (const t of torrents) {
    if (t.total_size && t.status === "completed") {
      const e = ext(t.filename) || ext(t.name);
      items.push({ ext: e, bytes: t.total_size });
    }
  }

  const categories: Record<string, { label: string; bytes: number; color: string }> = {
    video: { label: "Video", bytes: 0, color: "bg-ink" },
    audio: { label: "Audio", bytes: 0, color: "bg-success" },
    images: { label: "Images", bytes: 0, color: "bg-warning" },
    other: { label: "Other", bytes: 0, color: "bg-mute/40" },
  };

  for (const item of items) {
    if (VIDEO_EXTS.has(item.ext)) categories.video.bytes += item.bytes;
    else if (AUDIO_EXTS.has(item.ext)) categories.audio.bytes += item.bytes;
    else if (IMAGE_EXTS.has(item.ext)) categories.images.bytes += item.bytes;
    else categories.other.bytes += item.bytes;
  }

  return Object.values(categories).filter((c) => c.bytes > 0);
}

function formatGb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function StorageWidget({ downloads, torrents, systemStats }: StorageWidgetProps) {
  const diskUsed = systemStats?.disk_used_gb ?? 0;
  const diskTotal = systemStats?.disk_total_gb ?? 0;
  const usedPercent = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  const breakdown = computeBreakdown(downloads, torrents);
  const totalKnownBytes = breakdown.reduce((s, b) => s + b.bytes, 0);
  const totalDiskBytes = diskTotal * 1024 ** 3;

  return (
    <div className="bg-card border border-hairline p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-mute uppercase tracking-wider">
          Storage
        </h3>
        <span className="text-[11px] text-mute tabular-nums">
          {diskUsed.toFixed(0)} GB / {diskTotal.toFixed(0)} GB
        </span>
      </div>

      {/* Stacked bar */}
      <div className="relative h-2 bg-surface-card rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-ink/10 rounded-full transition-all duration-500"
          style={{ width: `${usedPercent}%` }}
        />
        {breakdown.length > 0 && (
          <div className="absolute inset-y-0 left-0 flex" style={{ width: `${usedPercent}%` }}>
            {breakdown.map((b) => {
              const pct = totalDiskBytes > 0 ? (b.bytes / totalDiskBytes) * 100 : 0;
              if (pct < 0.5) return null;
              return (
                <div
                  key={b.label}
                  className={`h-full ${b.color} first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${pct}%` }}
                  title={`${b.label}: ${formatGb(b.bytes)} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Legend + sizes */}
      {breakdown.length > 0 && (
        <div className="space-y-2 pt-1">
          {breakdown.map((b) => {
            const pct = totalKnownBytes > 0 ? (b.bytes / totalKnownBytes) * 100 : 0;
            return (
              <div key={b.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${b.color}`} />
                  <span className="text-[11px] text-mute">{b.label}</span>
                </div>
                <span className="text-[11px] tabular-nums text-mute">
                  {formatGb(b.bytes)}
                  <span className="text-mute/50 ml-1">({Math.round(pct)}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
