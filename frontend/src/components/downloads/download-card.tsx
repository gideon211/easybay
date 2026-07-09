import { useState, useEffect } from "react";
import {
  ExternalLink,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Pause,
  Play,
  Music,
  Youtube,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, getThumbnailUrl } from "@/lib/utils";
import { getDownloadFileUrl } from "@/lib/api";
import type { Download } from "@/lib/api";

function InstagramIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface DownloadCardProps {
  download: Download;
  onDelete: (id: number) => void;
  onPreview: (download: Download) => void;
  onPause?: (id: number) => void;
  onResume?: (id: number) => void;
}

function getStatusConfig(status: Download["status"]) {
  switch (status) {
    case "completed":
      return { variant: "success" as const, icon: CheckCircle, label: "Completed" };
    case "downloading":
      return { variant: "info" as const, icon: Loader2, label: "Downloading" };
    case "paused":
      return { variant: "warning" as const, icon: Pause, label: "Paused" };
    case "failed":
      return { variant: "destructive" as const, icon: XCircle, label: "Failed" };
    default:
      return { variant: "warning" as const, icon: Loader2, label: "Pending" };
  }
}

function PlatformIcon({ videoType }: { videoType: string }) {
  switch (videoType) {
    case "youtube":
      return <Youtube className="size-5 text-red-500" />;
    case "instagram":
      return <InstagramIcon />;
    case "tiktok":
      return <Music className="size-5 text-foreground" />;
    case "twitter":
      return <TwitterIcon />;
    default:
      return <Globe className="size-5 text-muted-foreground" />;
  }
}

export function DownloadCard({ download, onDelete, onPreview, onPause, onResume }: DownloadCardProps) {
  const [imgError, setImgError] = useState(false);
  const [backendThumbnail, setBackendThumbnail] = useState<string | null>(null);
  const statusConfig = getStatusConfig(download.status);
  const StatusIcon = statusConfig.icon;
  const isActive = ["pending", "downloading"].includes(download.status);
  const isPaused = download.status === "paused";
  const isStalled = download.status === "downloading" && (!download.speed || download.speed === "0.0MB/s");

  useEffect(() => {
    if (download.video_type !== "youtube") {
      setBackendThumbnail(null);
      setImgError(false);
      fetch(`/api/downloads/${download.id}/thumbnail`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.thumbnail_url) setBackendThumbnail(data.thumbnail_url);
        })
        .catch(() => {});
    }
  }, [download.id, download.video_type]);

  const thumbnailUrl = getThumbnailUrl(download.video_type, download.url) || backendThumbnail;
  const showThumbnail = thumbnailUrl && !imgError;
  const fileUrl = getDownloadFileUrl(download.id);

  return (
    <div
      className="group bg-card border border-border/50 rounded-xl overflow-hidden transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Thumbnail area */}
      <div
        className="relative aspect-video bg-muted overflow-hidden cursor-pointer"
        onClick={() => onPreview(download)}
      >
        {showThumbnail ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="size-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="size-full flex items-center justify-center">
            <PlatformIcon videoType={download.video_type} />
          </div>
        )}

        {/* Play button overlay on hover */}
        {download.status === "completed" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
            <div className="size-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 shadow-lg">
              <Play className="size-4 text-foreground ml-0.5" />
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <Badge variant={statusConfig.variant} className="text-[10px] px-2 py-0.5 gap-1 shadow-sm">
            <StatusIcon className={cn("size-3", (isActive || isPaused) && "animate-spin")} />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Platform badge */}
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 capitalize shadow-sm">
            {download.video_type}
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium leading-snug line-clamp-2" title={download.url}>
          {download.filename || download.url}
        </p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {download.quality && <span>{download.quality}</span>}
          {!isStalled && download.speed && (
            <>
              <span>·</span>
              <span>{download.speed}</span>
            </>
          )}
          {isStalled && (
            <>
              <span>·</span>
              <span className="animate-pulse text-muted-foreground/60">stalled</span>
            </>
          )}
        </div>

        {/* Progress bar for active/paused downloads */}
        {(isActive || isPaused) && (
          <div className="space-y-1">
            <Progress value={download.progress * 100} />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{Math.round(download.progress * 100)}%</span>
              {download.eta && download.status === "downloading" && <span>{download.eta} remaining</span>}
            </div>
          </div>
        )}

        {/* Error message */}
        {download.status === "failed" && download.error_message && (
          <p className="text-[11px] text-destructive line-clamp-2">{download.error_message}</p>
        )}

        {/* Paused message */}
        {isPaused && download.error_message && (
          <p className="text-[11px] text-muted-foreground line-clamp-1">{download.error_message}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1">
          {download.status === "completed" && download.filename && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
            >
              <ExternalLink className="size-3" />
              Open
            </a>
          )}

          {isPaused && onResume && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResume(download.id)}
              className="gap-1.5"
            >
              <Play className="size-3" />
              Resume
            </Button>
          )}

          {isActive && onPause && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPause(download.id)}
              className="gap-1.5"
            >
              <Pause className="size-3" />
              Pause
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(download.id)}
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
