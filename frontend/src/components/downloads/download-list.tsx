import { useState } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { DownloadCard } from "./download-card";
import { MediaPreview } from "./media-preview";
import { Skeleton } from "@/components/ui/skeleton";
import type { Download } from "@/lib/api";

interface DownloadListProps {
  downloads: Download[];
  loading: boolean;
  onDelete: (id: number) => void;
  onPause?: (id: number) => void;
  onResume?: (id: number) => void;
}

export function DownloadList({ downloads, loading, onDelete, onPause, onResume }: DownloadListProps) {
  const [previewId, setPreviewId] = useState<number | null>(null);
  const previewDownload = previewId
    ? downloads.find((d) => d.id === previewId)
    : null;
  const handlePreview = (download: Download) => setPreviewId(download.id);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Inbox className="size-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">No downloads yet</p>
        <p className="text-sm text-muted-foreground/80 mt-1">
          Paste a URL above to get started
        </p>
      </div>
    );
  }

  const active = downloads.filter(
    (d) => d.status === "pending" || d.status === "downloading" || d.status === "paused"
  );
  const completed = downloads.filter(
    (d) => d.status === "completed" || d.status === "failed"
  );

  return (
    <div className="space-y-8">
      {previewDownload && (
        <MediaPreview
          download={previewDownload}
          onClose={() => setPreviewId(null)}
        />
      )}

      {active.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Loader2 className="size-4 text-primary animate-spin" />
            <h2 className="text-lg font-semibold">
              Active
              <span className="text-muted-foreground font-normal text-sm ml-2">
                {active.length}
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((download) => (
              <DownloadCard
                key={download.id}
                download={download}
                onDelete={onDelete}
                onPreview={handlePreview}
                onPause={onPause}
                onResume={onResume}
              />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">
            History
            <span className="text-muted-foreground font-normal text-sm ml-2">
              {completed.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map((download) => (
              <DownloadCard
                key={download.id}
                download={download}
                onDelete={onDelete}
                onPreview={handlePreview}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
