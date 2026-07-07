import {
  ExternalLink,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Magnet,
  FileUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, formatBytes } from "@/lib/utils";
import { getTorrentFileUrl } from "@/lib/api";
import type { Torrent } from "@/lib/api";

interface TorrentCardProps {
  torrent: Torrent;
  onDelete: (id: number) => void;
}

function getStatusConfig(status: string) {
  switch (status) {
    case "completed":
      return { variant: "success" as const, icon: CheckCircle, label: "Completed" };
    case "downloading":
    case "resolving":
      return { variant: "info" as const, icon: Loader2, label: status === "resolving" ? "Resolving" : "Downloading" };
    case "error":
      return { variant: "destructive" as const, icon: XCircle, label: "Error" };
    case "cancelled":
      return { variant: "secondary" as const, icon: XCircle, label: "Cancelled" };
    default:
      return { variant: "warning" as const, icon: Loader2, label: "Queued" };
  }
}

export function TorrentCard({ torrent, onDelete }: TorrentCardProps) {
  const statusConfig = getStatusConfig(torrent.status);
  const StatusIcon = statusConfig.icon;
  const isActive = ["queued", "resolving", "downloading"].includes(torrent.status);
  const isMagnet = torrent.magnet?.startsWith("magnet:");

  return (
    <div className="group bg-card border border-border/50 rounded-xl overflow-hidden transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isMagnet ? (
              <Magnet className="size-5 shrink-0 text-primary" />
            ) : (
              <FileUp className="size-5 shrink-0 text-primary" />
            )}
            <span className="text-sm font-medium leading-snug line-clamp-2">
              {torrent.name || "Unknown Torrent"}
            </span>
          </div>
          <Badge variant={statusConfig.variant} className="text-[10px] px-2 py-0.5 gap-1 shrink-0">
            <StatusIcon className={cn("size-3", (torrent.status === "downloading" || torrent.status === "resolving") && "animate-spin")} />
            {statusConfig.label}
          </Badge>
        </div>

        {torrent.total_size && torrent.total_size > 0 && (
          <div className="text-xs text-muted-foreground">
            {formatBytes(torrent.total_size)}
            {torrent.peers > 0 && (
              <span className="ml-3">{torrent.peers} peers</span>
            )}
          </div>
        )}

        {isActive && (
          <div className="space-y-1">
            <Progress value={torrent.progress * 100} />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{Math.round(torrent.progress * 100)}%</span>
              {torrent.speed && <span>{torrent.speed}</span>}
            </div>
          </div>
        )}

        {torrent.status === "error" && torrent.error_message && (
          <p className="text-[11px] text-destructive line-clamp-2">{torrent.error_message}</p>
        )}

        <div className="flex items-center gap-1 pt-1">
          {torrent.status === "completed" && (
            <a
              href={getTorrentFileUrl(torrent.id)}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
            >
              <ExternalLink className="size-3" />
              Open
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(torrent.id)}
            className="text-destructive hover:text-destructive ml-auto"
          >
            <Trash2 className="size-3" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
