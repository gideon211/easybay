import { Magnet, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Torrent } from "@/lib/api";

interface TorrentMiniCardProps {
  torrent: Torrent;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="size-3 text-success" />;
    case "error":
    case "cancelled":
      return <XCircle className="size-3 text-destructive" />;
    default:
      return <Loader2 className="size-3 text-ink animate-spin" />;
  }
}

export function TorrentMiniCard({ torrent }: TorrentMiniCardProps) {
  const active = ["queued", "resolving", "downloading"].includes(torrent.status);

  return (
    <div className="flex items-center gap-2.5 p-2 rounded-sm hover:bg-surface-soft transition-colors">
      <div className="shrink-0 flex items-center justify-center size-7 rounded-sm bg-ink/10 text-ink">
        <Magnet className="size-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium truncate">
            {torrent.name || "Unknown Torrent"}
          </p>
          {getStatusIcon(torrent.status)}
        </div>
        {active && (
          <div className="mt-1">
            <Progress value={torrent.progress * 100} className="h-1" />
          </div>
        )}
      </div>
      {torrent.speed && active && (
        <span className="text-[10px] text-mute tabular-nums shrink-0">
          {torrent.speed}
        </span>
      )}
    </div>
  );
}
