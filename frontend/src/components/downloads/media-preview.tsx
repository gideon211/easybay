import { useEffect, useCallback } from "react";
import { X, Download as DownloadIcon, ExternalLink, Film, Music } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, isVideoFile, isAudioFile } from "@/lib/utils";
import { getDownloadFileUrl } from "@/lib/api";
import type { Download } from "@/lib/api";

interface MediaPreviewProps {
  download: Download;
  onClose: () => void;
}

export function MediaPreview({ download, onClose }: MediaPreviewProps) {
  const fileUrl = getDownloadFileUrl(download.id);
  const isVideo = isVideoFile(download.filename);
  const isAudio = isAudioFile(download.filename);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90dvh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/50">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base truncate">
              {download.filename || download.url}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="capitalize text-[10px] px-2 py-0">
                {download.video_type}
              </Badge>
              {download.quality && (
                <Badge variant="outline" className="text-[10px] px-2 py-0">
                  {download.quality}
                </Badge>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Media player */}
        <div className="flex-1 overflow-auto p-5">
          {download.status === "completed" && download.filename ? (
            <>
              {isVideo && (
                <video
                  src={fileUrl}
                  controls
                  className="w-full rounded-xl bg-black"
                  style={{ maxHeight: "60dvh" }}
                >
                  Your browser does not support video playback.
                </video>
              )}
              {isAudio && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Music className="size-10 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    {download.filename}
                  </p>
                  <audio
                    src={fileUrl}
                    controls
                    className="w-full max-w-md"
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}
              {!isVideo && !isAudio && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="size-16 rounded-full bg-muted flex items-center justify-center">
                    <Film className="size-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Preview not available for this file type.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <p className="text-sm font-medium">File not available</p>
              <p className="text-xs">
                {download.status === "failed"
                  ? "Download failed."
                  : "Download is still in progress."}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {download.status === "completed" && download.filename && (
          <div className="flex items-center justify-end gap-2 px-5 pb-4 pt-2 border-t border-border/50">
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ExternalLink className="size-3" />
              Open in new tab
            </a>
            <a
              href={fileUrl}
              download={download.filename}
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
            >
              <DownloadIcon className="size-3" />
              Download file
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
