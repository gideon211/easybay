import { toast } from "sonner";
import {
  Download as DownloadIcon,
  Trash2, RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Pause,
  Play,
  Music,
  Youtube,
  Globe,
  Camera,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, formatBytes, formatQuality, getThumbnailUrl } from "@/lib/utils";
import { getDownloadStreamUrl } from "@/lib/api";
import type { Download } from "@/lib/api";


interface ActiveDownloadCardProps {
  download: Download;
  onDelete: (id: number) => void;
  onPause?: (id: number) => void;
  onResume?: (id: number) => void;
  onRetry?: (id: number) => void;
  onRedownload?: (id: number) => void;
}

function getStatusConfig(status: Download["status"]) {
  switch (status) {
    case "completed":
      return { variant: "success" as const, icon: CheckCircle, label: "Completed" };
    case "downloading":
      return { variant: "info" as const, icon: Loader2, label: "Active" };
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
      return <Camera className="size-5 text-ink" />;
    case "tiktok":
      return <Music className="size-5 text-ink" />;
    case "twitter":
      return <MessageCircle className="size-5 text-ink" />;
    default:
      return <Globe className="size-5 text-mute" />;
  }
}

export function ActiveDownloadCard({ download, onDelete, onPause, onResume, onRetry, onRedownload }: ActiveDownloadCardProps) {
  const [imgError, setImgError] = useState(false);
  const [backendThumbnail, setBackendThumbnail] = useState<string | null>(null);
  const statusConfig = getStatusConfig(download.status);
  const StatusIcon = statusConfig.icon;
  const isActive = ["pending", "downloading"].includes(download.status);
  const isPaused = download.status === "paused";

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

  return (
    <div className="group bg-card border border-hairline overflow-hidden">
      {/* Thumbnail area */}
      <div className="relative aspect-video bg-surface-soft overflow-hidden">
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

        {/* Quality badge */}
        {download.quality && (
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
              {formatQuality(download.quality)}
            </Badge>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <Badge variant={statusConfig.variant} className="text-[10px] px-2 py-0.5 gap-1">
            <StatusIcon className={cn("size-3", (isActive || isPaused) && "animate-spin")} />
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium leading-snug line-clamp-2" title={download.url}>
          {download.filename || download.url}
        </p>

        <div className="flex items-center gap-2 text-xs text-mute">
          <PlatformIcon videoType={download.video_type} />
          <span className="capitalize">{download.video_type}</span>
          <span>·</span>
          <span>{formatQuality(download.quality)}</span>
          {download.file_size && (
            <>
              <span>·</span>
              <span className="tabular-nums">{formatBytes(download.file_size)}</span>
            </>
          )}
        </div>

        {/* Progress for active */}
        {(isActive || isPaused) && (
          <div className="space-y-1">
            <Progress value={download.progress * 100} className="h-1.5" />
            <div className="flex justify-between text-[10px] text-mute tabular-nums">
              <span>{download.speed || "—"}</span>
              <span>{Math.round(download.progress * 100)}%</span>
            </div>
            {download.eta && download.status === "downloading" && (
              <p className="text-[10px] text-mute">ETA {download.eta}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1">
          {download.status === "completed" && download.filename && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const url = getDownloadStreamUrl(download.id);
                const res = await fetch(url, { method: "HEAD" });
                if (res.ok) {
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "";
                  a.click();
                } else if (res.status === 404) {
                  toast.error("File expired on server — re-download it");
                  onRedownload?.(download.id);
                } else {
                  toast.error("Failed to download file");
                }
              }}
              className="gap-1.5"
            >
              <DownloadIcon className="size-3" />
              Save to device
            </Button>
          )}

          {download.status === "failed" && onRetry && (
            <Button variant="ghost" size="sm" onClick={() => onRetry(download.id)} className="gap-1.5">
              <RefreshCw className="size-3" />
              Retry
            </Button>
          )}

          {isPaused && onResume && (
            <Button variant="ghost" size="sm" onClick={() => onResume(download.id)} className="gap-1.5">
              <Play className="size-3" />
              Resume
            </Button>
          )}

          {isActive && onPause && (
            <Button variant="ghost" size="sm" onClick={() => onPause(download.id)} className="gap-1.5">
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
          </Button>
        </div>
      </div>
    </div>
  );
}
