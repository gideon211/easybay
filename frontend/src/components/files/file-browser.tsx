import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  File, FileImage, FileVideo, FileAudio, FileArchive,
  FileText, Download, Search, FolderOpen,
  Trash2, Clock, ArrowUpDown, Play, X
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

interface FileEntry {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  modified: string;
  extension: string;
}

type SortField = "name" | "size" | "modified";
type SortDir = "asc" | "desc";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mkv", ".avi", ".mov"]);
const AUDIO_EXTS = new Set([".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac"]);
const ARCHIVE_EXTS = new Set([".zip", ".tar", ".gz", ".rar", ".7z"]);
const MEDIA_EXTS = new Set([...IMAGE_EXTS, ...VIDEO_EXTS, ...AUDIO_EXTS]);

function FileIcon({ ext }: { ext: string }) {
  const cls = "size-4 shrink-0 text-mute";
  if (IMAGE_EXTS.has(ext)) return <FileImage className={cn(cls, "text-blue-500")} />;
  if (VIDEO_EXTS.has(ext)) return <FileVideo className={cn(cls, "text-purple-500")} />;
  if (AUDIO_EXTS.has(ext)) return <FileAudio className={cn(cls, "text-green-500")} />;
  if (ARCHIVE_EXTS.has(ext)) return <FileArchive className={cn(cls, "text-amber-500")} />;
  if ([".txt", ".md", ".json", ".xml", ".csv", ".log"].includes(ext)) return <FileText className={cn(cls, "text-cyan-500")} />;
  return <File className="size-4 shrink-0 text-mute" />;
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={cn("inline-flex ml-1 transition-opacity", active ? "opacity-100" : "opacity-30")}>
      <ArrowUpDown className={cn("size-3", dir === "asc" && "rotate-180")} />
    </span>
  );
}

function PreviewModal({ file, onClose }: { file: FileEntry; onClose: () => void }) {
  const dlUrl = `/api/files/download/${encodeURIComponent(file.name)}`;
  const previewUrl = IMAGE_EXTS.has(file.extension) ? `/api/files/preview/${encodeURIComponent(file.name)}` : dlUrl;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative bg-canvas border border-hairline rounded-sm max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-hairline shrink-0">
          <FileIcon ext={file.extension} />
          <span className="text-sm font-medium truncate flex-1">{file.name}</span>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-surface-soft transition-colors text-mute hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-4 min-h-[200px] bg-[#0a0a0a]">
          {VIDEO_EXTS.has(file.extension) && (
            <video
              key={file.name}
              controls
              autoPlay
              className="max-h-[70vh] max-w-full rounded-sm"
            >
              <source src={dlUrl} />
            </video>
          )}
          {AUDIO_EXTS.has(file.extension) && (
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="size-20 rounded-sm bg-surface-card flex items-center justify-center">
                <FileAudio className="size-8 text-purple-500" />
              </div>
              <audio key={file.name} controls autoPlay className="w-full max-w-md">
                <source src={dlUrl} />
              </audio>
            </div>
          )}
          {IMAGE_EXTS.has(file.extension) && (
            <img
              src={previewUrl}
              alt={file.name}
              className="max-h-[70vh] max-w-full object-contain rounded-sm"
            />
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center gap-3 px-4 h-10 border-t border-hairline shrink-0 text-[11px] text-mute">
          <span className="tabular-nums">{formatBytes(file.size)}</span>
          <span className="opacity-40">|</span>
          <span className="uppercase">{file.extension.replace(".", "")}</span>
          <span className="opacity-40">|</span>
          <span>{new Date(file.modified).toLocaleString()}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function FileBrowser() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);

  useEffect(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data: FileEntry[]) => {
        setFiles(data.filter((f) => !f.is_dir));
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load files");
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let items = files.filter((f) => f.name.toLowerCase().includes(q));

    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "size") cmp = a.size - b.size;
      else if (sortField === "modified") cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [files, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleDelete = async (name: string) => {
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setFiles((prev) => prev.filter((f) => f.name !== name));
    } catch {
      setError("Failed to delete file");
    }
  };

  const openPreview = useCallback((f: FileEntry) => {
    if (MEDIA_EXTS.has(f.extension)) setPreviewFile(f);
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-10 rounded-sm bg-surface-card animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 rounded-sm bg-surface-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Files</h1>
        <p className="text-sm text-body mt-0.5">
          Browse downloaded files on your server
        </p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-sm text-sm">
          {error}
        </div>
      )}

      <div className="bg-card border border-hairline overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-hairline">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-mute pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-surface-soft border border-hairline rounded-sm outline-none focus:border-ink placeholder:text-mute"
            />
          </div>
          <span className="text-[11px] text-mute tabular-nums ml-auto">
            {filtered.length} file{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-mute">
            <FolderOpen className="size-10 opacity-50 mb-3" />
            <p className="text-sm font-medium">{search ? "No matching files" : "No files yet"}</p>
            <p className="text-xs text-mute/80 mt-1">
              {search ? "Try a different search term" : "Downloaded files will appear here"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-[11px] text-mute uppercase tracking-wider">
                    <th className="text-left px-3 py-2.5 font-medium w-8" />
                    <th className="text-left px-3 py-2.5 font-medium">
                      <button onClick={() => handleSort("name")} className="inline-flex items-center hover:text-ink transition-colors">
                        Name
                        <SortArrow active={sortField === "name"} dir={sortField === "name" ? sortDir : "asc"} />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium w-24 tabular-nums">
                      <button onClick={() => handleSort("size")} className="inline-flex items-center hover:text-ink transition-colors">
                        Size
                        <SortArrow active={sortField === "size"} dir={sortField === "size" ? sortDir : "asc"} />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium w-12">Type</th>
                    <th className="text-left px-3 py-2.5 font-medium w-28 tabular-nums">
                      <button onClick={() => handleSort("modified")} className="inline-flex items-center hover:text-ink transition-colors">
                        Modified
                        <SortArrow active={sortField === "modified"} dir={sortField === "modified" ? sortDir : "asc"} />
                      </button>
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filtered.map((f) => (
                    <tr key={f.name} className="hover:bg-surface-soft transition-colors">
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => openPreview(f)}
                          className={cn(
                            "block",
                            MEDIA_EXTS.has(f.extension) && "cursor-pointer"
                          )}
                        >
                          {IMAGE_EXTS.has(f.extension) ? (
                            <img
                              src={`/api/files/preview/${encodeURIComponent(f.name)}`}
                              alt=""
                              className="size-8 rounded-sm object-cover border border-hairline hover:opacity-80 transition-opacity"
                            />
                          ) : (
                            <div className="size-8 rounded-sm bg-surface-card flex items-center justify-center border border-hairline">
                              {MEDIA_EXTS.has(f.extension) ? (
                                <div className="relative">
                                  <FileIcon ext={f.extension} />
                                  <Play className="absolute -bottom-1 -right-1 size-3 text-ink" />
                                </div>
                              ) : (
                                <FileIcon ext={f.extension} />
                              )}
                            </div>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 min-w-0">
                        <button
                          onClick={() => openPreview(f)}
                          className={cn(
                            "font-medium truncate max-w-[300px] block text-left",
                            MEDIA_EXTS.has(f.extension)
                              ? "hover:text-ink transition-colors cursor-pointer"
                              : "cursor-default"
                          )}
                          title={f.name}
                        >
                          {f.name}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-mute text-xs tabular-nums">{formatBytes(f.size)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] text-mute bg-surface-card rounded-sm px-1.5 py-0.5 leading-none uppercase">
                          {f.extension.replace(".", "") || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-mute text-xs tabular-nums flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(f.modified).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {MEDIA_EXTS.has(f.extension) ? (
                            <button
                              onClick={() => openPreview(f)}
                              className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-surface-soft transition-colors text-mute hover:text-ink"
                              title="Preview"
                            >
                              <Play className="size-3.5" />
                            </button>
                          ) : (
                            <a
                              href={`/api/files/download/${encodeURIComponent(f.name)}`}
                              className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-surface-soft transition-colors text-mute hover:text-ink"
                              title="Download"
                            >
                              <Download className="size-3.5" />
                            </a>
                          )}
                          <a
                            href={`/api/files/download/${encodeURIComponent(f.name)}`}
                            className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-surface-soft transition-colors text-mute hover:text-ink"
                            title="Download file"
                          >
                            <Download className="size-3.5" />
                          </a>
                          <button
                            onClick={() => handleDelete(f.name)}
                            className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-destructive/10 transition-colors text-mute hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-hairline">
              {filtered.map((f) => (
                <div
                  key={f.name}
                  onClick={() => openPreview(f)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3",
                    MEDIA_EXTS.has(f.extension) ? "cursor-pointer hover:bg-surface-soft transition-colors" : ""
                  )}
                >
                  <button onClick={(e) => { e.stopPropagation(); openPreview(f); }} className="shrink-0">
                    {IMAGE_EXTS.has(f.extension) ? (
                      <img
                        src={`/api/files/preview/${encodeURIComponent(f.name)}`}
                        alt=""
                        className="size-10 rounded-sm object-cover border border-hairline shrink-0 hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <div className="size-10 rounded-sm bg-surface-card flex items-center justify-center border border-hairline shrink-0">
                        {MEDIA_EXTS.has(f.extension) ? (
                          <div className="relative">
                            <FileIcon ext={f.extension} />
                            <Play className="absolute -bottom-1 -right-1 size-3 text-ink" />
                          </div>
                        ) : (
                          <FileIcon ext={f.extension} />
                        )}
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-mute">
                      <span className="tabular-nums">{formatBytes(f.size)}</span>
                      <span>·</span>
                      <span className="uppercase">{f.extension.replace(".", "") || "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`/api/files/download/${encodeURIComponent(f.name)}`}
                      className="inline-flex items-center justify-center size-8 rounded-sm hover:bg-surface-soft transition-colors text-mute hover:text-ink"
                      title="Download"
                    >
                      <Download className="size-4" />
                    </a>
                    <button
                      onClick={() => handleDelete(f.name)}
                      className="inline-flex items-center justify-center size-8 rounded-sm hover:bg-destructive/10 transition-colors text-mute hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Preview modal */}
      <AnimatePresence>
        {previewFile && (
          <PreviewModal key={previewFile.name} file={previewFile} onClose={() => setPreviewFile(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
