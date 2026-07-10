import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Loader2, ExternalLink, Trash2, Magnet, FileUp,
  CheckCircle2, XCircle, Clock, ArrowUpDown,
  Users, Copy
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatBytes } from "@/lib/utils";
import { getTorrentFileUrl } from "@/lib/api";
import type { Torrent } from "@/lib/api";

type StatusFilter = "all" | "active" | "seeding" | "completed" | "error";
type SortField = "name" | "size" | "progress" | "status" | "date";
type SortDir = "asc" | "desc";

interface TorrentListProps {
  torrents: Torrent[];
  loading: boolean;
  onDelete: (id: number) => void;
}

function StatusBadge({ status }: { status: string }) {
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
          Downloading
        </Badge>
      );
    case "resolving":
      return (
        <Badge variant="warning" className="gap-1 text-[10px] px-2 py-0">
          <Loader2 className="size-3 animate-spin" />
          Resolving
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="gap-1 text-[10px] px-2 py-0">
          <XCircle className="size-3" />
          Error
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="secondary" className="gap-1 text-[10px] px-2 py-0">
          <XCircle className="size-3" />
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="warning" className="gap-1 text-[10px] px-2 py-0">
          <Clock className="size-3" />
          Queued
        </Badge>
      );
  }
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={cn("inline-flex ml-1 transition-opacity", active ? "opacity-100" : "opacity-30")}>
      <ArrowUpDown className={cn("size-3", dir === "asc" && "rotate-180")} />
    </span>
  );
}

export function TorrentList({ torrents, loading, onDelete }: TorrentListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const statusCounts = useMemo(() => ({
    all: torrents.length,
    active: torrents.filter((t) => ["queued", "resolving", "downloading"].includes(t.status)).length,
    seeding: torrents.filter((t) => t.status === "completed" && t.progress >= 1).length,
    completed: torrents.filter((t) => t.status === "completed").length,
    error: torrents.filter((t) => t.status === "error" || t.status === "cancelled").length,
  }), [torrents]);

  const filtered = useMemo(() => {
    let items = [...torrents];
    if (statusFilter === "active") {
      items = items.filter((t) => ["queued", "resolving", "downloading"].includes(t.status));
    } else if (statusFilter === "completed") {
      items = items.filter((t) => t.status === "completed");
    } else if (statusFilter === "error") {
      items = items.filter((t) => t.status === "error" || t.status === "cancelled");
    }

    items.sort((a, b) => {
      const dateA = new Date(a.completed_at ?? a.created_at ?? 0).getTime();
      const dateB = new Date(b.completed_at ?? b.created_at ?? 0).getTime();
      return sortDir === "desc" ? dateB - dateA : dateA - dateB;
    });

    return items;
  }, [torrents, statusFilter, sortField, sortDir]);

  const filterTabs: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "seeding", label: "Seeding" },
    { id: "completed", label: "Completed" },
    { id: "error", label: "Error" },
  ];

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-sm bg-surface-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (torrents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-mute">
        <div className="size-16 rounded-sm bg-surface-card flex items-center justify-center mb-4">
          <Magnet className="size-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">No torrents yet</p>
        <p className="text-sm text-mute/80 mt-1">
          Add a magnet link or upload a .torrent file to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={cn(
              "px-3 py-1.5 rounded-sm text-xs font-medium transition-colors",
              statusFilter === tab.id
                ? "bg-ink text-canvas"
                : "bg-surface-card text-mute hover:text-ink"
            )}
          >
            {tab.label}
            {tab.id !== "all" && (
              <span className="ml-1.5 text-[10px] opacity-70">
                ({statusCounts[tab.id]})
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto text-[11px] text-mute hidden sm:block">
          {filtered.length} torrent{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {filtered.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card border border-hairline overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-hairline text-[11px] text-mute uppercase tracking-wider">
                    <th className="text-left px-3 py-2.5 font-medium w-8" />
                    <th className="text-left px-3 py-2.5 font-medium">Name</th>
                    <th className="text-left px-3 py-2.5 font-medium w-20 tabular-nums">Size</th>
                    <th className="text-left px-3 py-2.5 font-medium w-16 tabular-nums">
                      <span className="inline-flex items-center gap-1"><Users className="size-3" /> Peers</span>
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium w-24">Progress</th>
                    <th className="text-left px-3 py-2.5 font-medium w-24">Status</th>
                    <th className="text-left px-3 py-2.5 font-medium w-20 tabular-nums">Speed</th>
                    <th className="text-left px-3 py-2.5 font-medium w-20 tabular-nums">
                      <button onClick={() => { setSortField("date"); setSortDir((p) => p === "asc" ? "desc" : "asc"); }} className="inline-flex items-center hover:text-ink transition-colors">
                        Date
                        <SortArrow active={sortField === "date"} dir={sortField === "date" ? sortDir : "desc"} />
                      </button>
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filtered.map((t) => {
                    const isMagnet = t.magnet?.startsWith("magnet:");
                    const isActive = ["queued", "resolving", "downloading"].includes(t.status);
                    const fileUrl = getTorrentFileUrl(t.id);

                    return (
                      <tr key={t.id} className={cn(
                        "transition-colors",
                        t.status === "error" ? "bg-destructive/[0.02]" : "hover:bg-surface-soft"
                      )}>
                        {/* Type icon */}
                        <td className="px-3 py-2.5">
                          {isMagnet ? (
                            <Magnet className="size-4 text-ink shrink-0" />
                          ) : (
                            <FileUp className="size-4 text-ink shrink-0" />
                          )}
                        </td>

                        {/* Name */}
                        <td className="px-3 py-2.5 min-w-0">
                          <span className="font-medium truncate max-w-[200px] block" title={t.name ?? ""}>
                            {t.name || t.filename || "Unknown Torrent"}
                          </span>
                        </td>

                        {/* Size */}
                        <td className="px-3 py-2.5">
                          <span className="text-mute text-xs tabular-nums">
                            {t.total_size ? formatBytes(t.total_size) : "—"}
                          </span>
                        </td>

                        {/* Peers */}
                        <td className="px-3 py-2.5">
                          <span className="text-mute text-xs tabular-nums">
                            {t.peers > 0 ? t.peers : "—"}
                          </span>
                        </td>

                        {/* Progress */}
                        <td className="px-3 py-2.5 min-w-0">
                          {isActive ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex-1 max-w-[80px]">
                                <div className="h-1.5 bg-surface-card rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-ink rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.max(0, t.progress * 100))}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-[11px] text-mute tabular-nums shrink-0">
                                {Math.round(t.progress * 100)}%
                              </span>
                            </div>
                          ) : t.status === "completed" ? (
                            <span className="text-xs text-success tabular-nums">100%</span>
                          ) : (
                            <span className="text-xs text-mute">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5">
                          <StatusBadge status={t.status} />
                          {t.status === "error" && t.error_message && (
                            <p className="text-[10px] text-destructive mt-0.5 truncate max-w-[120px]" title={t.error_message}>
                              {t.error_message}
                            </p>
                          )}
                        </td>

                        {/* Speed */}
                        <td className="px-3 py-2.5">
                          <span className="text-mute text-xs tabular-nums">
                            {isActive && t.speed ? t.speed : "—"}
                          </span>
                          {isActive && t.eta && (
                            <span className="text-[10px] text-mute block tabular-nums">
                              ETA {t.eta}
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-3 py-2.5">
                          <span className="text-mute text-xs tabular-nums">
                            {t.completed_at
                              ? new Date(t.completed_at).toLocaleDateString()
                              : t.created_at
                              ? new Date(t.created_at).toLocaleDateString()
                              : "—"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(t.magnet);
                                toast.success("Magnet copied");
                              }}
                              className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-surface-soft transition-colors text-mute hover:text-ink"
                              title="Copy magnet"
                            >
                              <Copy className="size-3.5" />
                            </button>
                            {t.status === "completed" && (
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
                              onClick={() => onDelete(t.id)}
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
            {filtered.map((t) => {
              const isMagnet = t.magnet?.startsWith("magnet:");
              const isActive = ["queued", "resolving", "downloading"].includes(t.status);
              const fileUrl = getTorrentFileUrl(t.id);

              return (
                <div
                  key={t.id}
                  className={cn(
                    "bg-card border border-hairline p-3 space-y-2.5",
                    t.status === "error" && "border-destructive/20"
                  )}
                >
                  {/* Top: icon + name + status */}
                  <div className="flex items-start gap-2.5">
                    {isMagnet ? (
                      <Magnet className="size-5 shrink-0 text-ink mt-0.5" />
                    ) : (
                      <FileUp className="size-5 shrink-0 text-ink mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-snug line-clamp-2">
                        {t.name || t.filename || "Unknown Torrent"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-mute">
                        {t.total_size && <span className="tabular-nums">{formatBytes(t.total_size)}</span>}
                        {t.peers > 0 && <span>· {t.peers} peers</span>}
                      </div>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>

                  {/* Progress */}
                  {isActive && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-surface-card rounded-full overflow-hidden">
                          <div
                            className="h-full bg-ink rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, t.progress * 100))}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-mute tabular-nums shrink-0">
                          {Math.round(t.progress * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-mute tabular-nums">
                        {t.speed && <span>{t.speed}</span>}
                        {t.eta && <span>ETA {t.eta}</span>}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {t.status === "error" && t.error_message && (
                    <p className="text-[11px] text-destructive line-clamp-2">{t.error_message}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-0.5">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(t.magnet);
                        toast.success("Magnet copied");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-ink hover:text-ink-deep transition-colors px-2 py-1 rounded-sm hover:bg-surface-soft"
                    >
                      <Copy className="size-3" />
                      Copy
                    </button>
                    {t.status === "completed" && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink hover:text-ink-deep transition-colors px-2 py-1 rounded-sm hover:bg-surface-soft"
                      >
                        <ExternalLink className="size-3" />
                        Open
                      </a>
                    )}
                    <button
                      onClick={() => onDelete(t.id)}
                      className="ml-auto inline-flex items-center justify-center size-7 rounded-sm hover:bg-destructive/10 transition-colors text-mute hover:text-destructive"
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
