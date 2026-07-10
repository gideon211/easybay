import { Download as DownloadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import type { Download, Torrent } from "@/lib/api";

type ActivityItem = {
  id: number;
  type: "download" | "torrent";
  label: string;
  status: string;
  timestamp: string | null;
  platform?: string;
  fileSize?: number | null;
};

interface ActivityFeedProps {
  downloads: Download[];
  torrents: Torrent[];
  loading?: boolean;
}

function toActivityItem(
  item: Download | Torrent,
  type: "download" | "torrent"
): ActivityItem {
  if (type === "download") {
    const d = item as Download;
    return {
      id: d.id,
      type: "download",
      label: d.filename || d.url.slice(0, 60),
      status: d.status,
      timestamp: d.completed_at || d.created_at,
      platform: d.video_type,
      fileSize: d.file_size,
    };
  }
  const t = item as Torrent;
  return {
    id: t.id,
    type: "torrent",
    label: t.name || "Unknown torrent",
    status: t.status,
    timestamp: t.completed_at || t.created_at,
  };
}

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case "youtube":
      return (
        <div className="size-8 rounded-sm bg-red-500/10 flex items-center justify-center shrink-0">
          <DownloadIcon className="size-3.5 text-red-500" />
        </div>
      );
    case "tiktok":
      return (
        <div className="size-8 rounded-sm bg-ink/10 flex items-center justify-center shrink-0">
          <DownloadIcon className="size-3.5 text-ink" />
        </div>
      );
    case "instagram":
      return (
        <div className="size-8 rounded-sm bg-pink-500/10 flex items-center justify-center shrink-0">
          <DownloadIcon className="size-3.5 text-pink-500" />
        </div>
      );
    case "twitter":
      return (
        <div className="size-8 rounded-sm bg-sky-500/10 flex items-center justify-center shrink-0">
          <DownloadIcon className="size-3.5 text-sky-500" />
        </div>
      );
    default:
      return (
        <div className="size-8 rounded-sm bg-surface-card flex items-center justify-center shrink-0">
          <DownloadIcon className="size-3.5 text-mute" />
        </div>
      );
  }
}

function getRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "";
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay === 1) return "yesterday";
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getStatusVariant(status: string): "success" | "destructive" | "info" | "warning" {
  switch (status) {
    case "completed": return "success";
    case "failed":
    case "error": return "destructive";
    case "downloading":
    case "pending":
    case "resolving":
    case "queued": return "info";
    default: return "warning";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "completed": return "Completed";
    case "failed": return "Failed";
    case "error": return "Error";
    case "downloading": return "Downloading";
    case "pending": return "Pending";
    case "resolving": return "Resolving";
    case "queued": return "Queued";
    default: return status;
  }
}

export function ActivityFeed({ downloads, torrents, loading }: ActivityFeedProps) {
  const items: ActivityItem[] = [
    ...downloads.map((d) => toActivityItem(d, "download")),
    ...torrents.map((t) => toActivityItem(t, "torrent")),
  ].sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-sm animate-pulse">
            <div className="size-8 rounded-sm bg-surface-card" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-surface-card rounded-sm w-3/4" />
              <div className="h-2 bg-surface-card rounded-sm w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-mute">
        <DownloadIcon className="size-6 opacity-50 mb-2" />
        <p className="text-sm font-medium">No activity yet</p>
        <p className="text-xs text-mute/70 mt-0.5">
          Add a download to see it here
        </p>
      </div>
    );
  }

  const recent = items.slice(0, 8);

  return (
    <div className="divide-y divide-hairline">
      {recent.map((item) => (
        <div
          key={`${item.type}-${item.id}`}
          className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          <PlatformIcon platform={item.platform || ""} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium break-words leading-snug">{item.label}</p>
            <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5">
              <span className="text-[11px] text-mute capitalize">
                {item.type === "download" ? item.platform : "Torrent"}
              </span>
              {item.fileSize && (
                <>
                  <span className="text-[11px] text-mute/50">·</span>
                  <span className="text-[11px] text-mute tabular-nums">{formatBytes(item.fileSize)}</span>
                </>
              )}
              {item.timestamp && (
                <>
                  <span className="text-[11px] text-mute/50">·</span>
                  <span className="text-[11px] text-mute/50">
                    {getRelativeTime(item.timestamp)}
                  </span>
                </>
              )}
            </div>
          </div>
          <Badge variant={getStatusVariant(item.status)} className="text-[10px] px-2 py-0">
            {getStatusLabel(item.status)}
          </Badge>
        </div>
      ))}
    </div>
  );
}
