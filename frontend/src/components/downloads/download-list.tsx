import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  Inbox, Loader2, ExternalLink, Trash2,
  Pause, Play, Youtube, Music, Camera,
  MessageCircle, Globe, CheckCircle2, XCircle,
  Clock, ArrowUpDown, Copy
} from "lucide-react";
import { MediaPreview } from "./media-preview";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn, formatQuality } from "@/lib/utils";
import { getDownloadFileUrl } from "@/lib/api";
import type { Download } from "@/lib/api";

type StatusFilter = "all" | "active" | "completed" | "failed";
type SortField = "date" | "status" | "name";
type SortDir = "asc" | "desc";

interface DownloadListProps {
  downloads: Download[];
  loading: boolean;
  onDelete: (id: number) => void;
  onPause?: (id: number) => void;
  onResume?: (id: number) => void;
}

const thumbnailCache = new Map<number, string | null>();

function DownloadThumbnail({ download, className }: { download: Download; className?: string }) {
  const [thumb, setThumb] = useState<string | null | undefined>(thumbnailCache.get(download.id));

  useEffect(() => {
    if (thumb !== undefined) return;
    fetch(`/api/downloads/${download.id}/thumbnail`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        const url = data.thumbnail_url ?? null;
        thumbnailCache.set(download.id, url);
        setThumb(url);
      })
      .catch(() => {
        thumbnailCache.set(download.id, null);
        setThumb(null);
      });
  }, [download.id, thumb]);

  const cls = cn("size-4 shrink-0", className);

  if (thumb) {
    return (
      <img
        src={thumb}
        alt=""
        className={cn("size-8 rounded-sm object-cover border border-hairline", className)}
        loading="lazy"
      />
    );
  }

  // Fallback to platform icon
  switch (download.video_type) {
    case "youtube":
      return <Youtube className={cn(cls, "text-red-500")} />;
    case "tiktok":
      return <Music className={cls} />;
    case "instagram":
      return <Camera className={cls} />;
    case "twitter":
      return <MessageCircle className={cls} />;
    default:
      return <Globe className={cn(cls, "text-mute")} />;
  }
}

function StatusBadge({ status }: { status: Download["status"] }) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="success" className="gap-1 text-[10px] px-2 py-0">
          <CheckCircle2 className="size-3" />
          Completed
        </Badge>
      );
    case "downloading":
      return (
        <Badge variant="info" className="gap-1 text-[10px] px-2 py-0">
          <Loader2 className="size-3 animate-spin" />
          Active
        </Badge>
      );
    case "paused":
      return (
        <Badge variant="warning" className="gap-1 text-[10px] px-2 py-0">
          <Pause className="size-3" />
          Paused
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1 text-[10px] px-2 py-0">
          <XCircle className="size-3" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="warning" className="gap-1 text-[10px] px-2 py-0">
          <Clock className="size-3" />
          Pending
        </Badge>
      );
  }
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={cn(
      "inline-flex ml-1 transition-opacity",
      active ? "opacity-100" : "opacity-30"
    )}>
      <ArrowUpDown className={cn("size-3", dir === "asc" && "rotate-180")} />
    </span>
  );
}

export function DownloadList({ downloads, loading, onDelete, onPause, onResume }: DownloadListProps) {
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const previewDownload = previewId
    ? downloads.find((d) => d.id === previewId)
    : null;

  const statusCounts = useMemo(() => ({
    all: downloads.length,
    active: downloads.filter((d) => ["pending", "downloading", "paused"].includes(d.status)).length,
    completed: downloads.filter((d) => d.status === "completed").length,
    failed: downloads.filter((d) => d.status === "failed").length,
  }), [downloads]);

  const filtered = useMemo(() => {
    let items = [...downloads];
    if (statusFilter === "active") {
      items = items.filter((d) => ["pending", "downloading", "paused"].includes(d.status));
    } else if (statusFilter === "completed") {
      items = items.filter((d) => d.status === "completed");
    } else if (statusFilter === "failed") {
      items = items.filter((d) => d.status === "failed");
    }

    items.sort((a, b) => {
      const dateA = new Date(a.completed_at ?? a.created_at ?? 0).getTime();
      const dateB = new Date(b.completed_at ?? b.created_at ?? 0).getTime();
      return sortDir === "desc" ? dateB - dateA : dateA - dateB;
    });

    return items;
  }, [downloads, statusFilter, sortField, sortDir]);

  const filterTabs: StatusFilter[] = ["all", "active", "completed", "failed"];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-sm bg-surface-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-mute">
        <div className="size-16 rounded-sm bg-surface-card flex items-center justify-center mb-4">
          <Inbox className="size-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">No downloads yet</p>
        <p className="text-sm text-mute/80 mt-1">
          Paste a URL above to get started
        </p>
      </div>
    );
  }

  const isActive = (d: Download) => d.status === "downloading" || d.status === "pending";
  const isPaused = (d: Download) => d.status === "paused";

  return (
    <div className="space-y-4">
      {previewDownload && (
        <MediaPreview
          download={previewDownload}
          onClose={() => setPreviewId(null)}
        />
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5">
        {filterTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={cn(
              "px-3 py-1.5 rounded-sm text-xs font-medium transition-colors",
              statusFilter === tab
                ? "bg-ink text-canvas"
                : "bg-surface-card text-mute hover:text-ink"
            )}
          >
            {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className="ml-1.5 text-[10px] opacity-70">
              ({statusCounts[tab]})
            </span>
          </button>
        ))}
        <div className="ml-auto text-[11px] text-mute hidden sm:block">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Desktop table */}
      {filtered.length > 0 && (
        <>
          <div className="hidden md:block bg-card border border-hairline overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-hairline text-[11px] text-mute uppercase tracking-wider">
                    <th className="text-left px-3 py-2.5 font-medium w-8" />
                    <th className="text-left px-3 py-2.5 font-medium">File</th>
                    <th className="text-left px-3 py-2.5 font-medium w-20">Quality</th>
                    <th className="text-left px-3 py-2.5 font-medium w-32">Status</th>
                    <th className="text-left px-3 py-2.5 font-medium w-28">Progress</th>
                    <th className="text-left px-3 py-2.5 font-medium w-20 tabular-nums">
                      <button onClick={() => handleSort("date")} className="inline-flex items-center hover:text-ink transition-colors">
                        Date
                        <SortArrow active={sortField === "date"} dir={sortField === "date" ? sortDir : "desc"} />
                      </button>
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filtered.map((d) => {
                    const fileUrl = getDownloadFileUrl(d.id);
                    const active = isActive(d);
                    const paused = isPaused(d);
                    const fileExt = d.filename?.split(".").pop()?.toUpperCase();

                    return (
                      <tr key={d.id} className={cn(
                        "transition-colors",
                        d.status === "failed" ? "bg-destructive/[0.02]" : "hover:bg-surface-soft"
                      )}>
                        {/* Platform icon / thumbnail */}
                        <td className="px-3 py-2.5">
                          <DownloadThumbnail download={d} />
                        </td>

                        {/* Filename */}
                        <td className="px-3 py-2.5 min-w-0">
                          <button
                            onClick={() => setPreviewId(d.id)}
                            className="flex items-center gap-2 hover:text-ink transition-colors text-left"
                          >
                            <span className="font-medium truncate max-w-[200px]">
                              {d.filename || d.url.split("/").pop() || "Unknown"}
                            </span>
                            {fileExt && (
                              <span className="shrink-0 text-[10px] text-mute bg-surface-card rounded-sm px-1 py-0.5 leading-none">
                                {fileExt}
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Quality */}
                        <td className="px-3 py-2.5">
                          <span className="text-mute text-xs">{d.quality ? formatQuality(d.quality) : "—"}</span>
                        </td>

                        {/* Status badge */}
                        <td className="px-3 py-2.5">
                          <StatusBadge status={d.status} />
                          {d.status === "failed" && d.error_message && (
                            <p className="text-[10px] text-destructive mt-0.5 truncate max-w-[160px]" title={d.error_message}>
                              {d.error_message}
                            </p>
                          )}
                        </td>

                        {/* Progress / Completion info */}
                        <td className="px-3 py-2.5 min-w-0">
                          {(active || paused) && (
                            <div className="flex items-center gap-2 min-w-0">
                              <Progress value={d.progress * 100} className="h-1.5 flex-1 max-w-[100px]" />
                              <span className="text-[11px] text-mute tabular-nums shrink-0">
                                {Math.round(d.progress * 100)}%
                              </span>
                            </div>
                          )}
                          {active && (
                            <div className="flex items-center gap-2 text-[10px] text-mute mt-0.5 tabular-nums">
                              {d.speed && <span>{d.speed}</span>}
                              {d.eta && <span>ETA {d.eta}</span>}
                            </div>
                          )}
                          {paused && d.speed && (
                            <span className="text-[10px] text-mute tabular-nums">{d.speed}</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-3 py-2.5">
                          <span className="text-mute text-xs tabular-nums">
                            {d.completed_at
                              ? new Date(d.completed_at).toLocaleDateString()
                              : d.created_at
                              ? new Date(d.created_at).toLocaleDateString()
                              : "—"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(d.url);
                                toast.success("URL copied");
                              }}
                              className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-surface-soft transition-colors text-mute hover:text-ink"
                              title="Copy URL"
                            >
                              <Copy className="size-3.5" />
                            </button>
                            {paused && onResume && (
                              <button
                                onClick={() => onResume(d.id)}
                                className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-surface-soft transition-colors text-mute hover:text-ink"
                                title="Resume"
                              >
                                <Play className="size-3.5" />
                              </button>
                            )}
                            {(active || d.status === "pending") && onPause && (
                              <button
                                onClick={() => onPause(d.id)}
                                className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-surface-soft transition-colors text-mute hover:text-ink"
                                title="Pause"
                              >
                                <Pause className="size-3.5" />
                              </button>
                            )}
                            {d.status === "completed" && d.filename && (
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-surface-soft transition-colors text-mute hover:text-ink"
                                title="Open file"
                              >
                                <ExternalLink className="size-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => onDelete(d.id)}
                              className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-destructive/10 transition-colors text-mute hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile list */}
          <div className="md:hidden space-y-2">
            {filtered.map((d) => {
              const fileUrl = getDownloadFileUrl(d.id);
              const active = isActive(d);
              const paused = isPaused(d);
              const showPreview = d.status === "completed";

              return (
                <div
                  key={d.id}
                  className={cn(
                    "bg-card border border-hairline p-3 space-y-2.5",
                    d.status === "failed" && "border-destructive/20"
                  )}
                >
                  {/* Top row: icon + filename */}
                  <div className="flex items-start gap-2.5">
                    <DownloadThumbnail download={d} className="size-10 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => showPreview && setPreviewId(d.id)}
                        className="font-medium text-sm leading-snug line-clamp-2 text-left hover:text-ink transition-colors break-words"
                      >
                        {d.filename || d.url.split("/").pop() || "Unknown"}
                      </button>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-mute">
                        <span className="capitalize">{d.video_type}</span>
                        {d.quality && <span>· {formatQuality(d.quality)}</span>}
                      </div>
                      <div className="mt-1.5">
                        <StatusBadge status={d.status} />
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  {(active || paused) && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Progress value={d.progress * 100} className="h-1.5 flex-1" />
                          <span className="text-[11px] text-mute tabular-nums shrink-0">
                          {Math.round(d.progress * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-mute tabular-nums">
                        {d.speed && <span>{d.speed}</span>}
                        {d.eta && <span>ETA {d.eta}</span>}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {d.status === "failed" && d.error_message && (
                    <p className="text-[11px] text-destructive line-clamp-2">{d.error_message}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-0.5">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(d.url);
                        toast.success("URL copied");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-accent"
                    >
                      <Copy className="size-3" />
                      Copy
                    </button>
                    {paused && onResume && (
                      <button
                        onClick={() => onResume(d.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-accent"
                      >
                        <Play className="size-3" />
                        Resume
                      </button>
                    )}
                    {(active || d.status === "pending") && onPause && (
                      <button
                        onClick={() => onPause(d.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-accent"
                      >
                        <Pause className="size-3" />
                        Pause
                      </button>
                    )}
                    {d.status === "completed" && d.filename && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-accent"
                      >
                        <ExternalLink className="size-3" />
                        Open
                      </a>
                    )}
                    <button
                      onClick={() => onDelete(d.id)}
                      className="ml-auto inline-flex items-center justify-center size-7 rounded-sm hover:bg-destructive/10 transition-colors text-mute hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
