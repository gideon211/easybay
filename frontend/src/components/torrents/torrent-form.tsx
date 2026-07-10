import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Magnet, FileUp, Loader2, Upload, CheckCircle2, X, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TorrentFormProps {
  onSubmit: (source: string, file?: File) => Promise<void>;
  isSubmitting: boolean;
}

type Mode = "magnet" | "file";

const modeTabs: { id: Mode; label: string; icon: typeof Magnet }[] = [
  { id: "magnet", label: "Magnet Link", icon: Magnet },
  { id: "file", label: ".torrent File", icon: FileUp },
];

const fastSpring = { type: "spring" as const, stiffness: 400, damping: 30 };

export function TorrentForm({ onSubmit, isSubmitting }: TorrentFormProps) {
  const [mode, setMode] = useState<Mode>("magnet");
  const [source, setSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".torrent")) return;
    setFile(f);
    setSource(f.name);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "magnet" && !source.trim()) return;
    if (mode === "file" && !file) return;
    await onSubmit(mode === "file" ? (file?.name ?? "") : source.trim(), file ?? undefined);
    setSource("");
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const canSubmit = mode === "magnet" ? source.trim().length > 0 : file !== null;

  return (
    <div className="bg-card border border-hairline">
      <div className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode toggle */}
          <div className="relative flex gap-1 rounded-sm bg-surface-card p-1 w-fit">
            {modeTabs.map((t) => {
              const Icon = t.icon;
              const isActive = mode === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMode(t.id)}
                  className={cn(
                    "relative z-10 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors duration-200 cursor-pointer",
                    isActive ? "text-ink" : "text-mute hover:text-ink"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="torrent-mode-indicator"
                      className="absolute inset-0 rounded-sm bg-canvas"
                      transition={fastSpring}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className="size-3.5" />
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

            <AnimatePresence mode="wait">
              {mode === "magnet" ? (
                <motion.div
                  key="magnet"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-1.5"
                >
                  <label htmlFor="magnet-input" className="text-sm font-medium text-ink flex items-center gap-2">
                    <Link2 className="size-3.5 text-mute" />
                    Magnet URI
                  </label>
                  <Input
                    id="magnet-input"
                    type="text"
                    placeholder="magnet:?xt=urn:btih:..."
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="flex-1 font-mono text-xs"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="file"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <label
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={cn(
                      "relative block border border-dashed rounded-sm p-8 text-center transition-all duration-300 cursor-pointer overflow-hidden",
                      dragOver && "border-ink/60 bg-ink/[0.03]",
                      file && !dragOver && "border-ink/20 bg-ink/[0.02]",
                      !file && !dragOver && "border-hairline hover:border-mute/30 hover:bg-surface-soft",
                    )}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".torrent"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    {!file ? (
                      <div className="flex flex-col items-center gap-2 text-mute">
                        <motion.div
                          animate={dragOver ? { y: -4, scale: 1.1 } : { y: 0, scale: 1 }}
                          transition={fastSpring}
                        >
                          <Upload className="size-7" />
                        </motion.div>
                        <span className="font-medium text-sm">Drop a .torrent file or click to browse</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-sm text-mute">
                        <CheckCircle2 className="size-4 text-success" />
                        <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            setSource("");
                          }}
                          className="ml-1 text-mute hover:text-destructive transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    )}
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" disabled={isSubmitting || !canSubmit} size="lg" className="w-full gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  {mode === "magnet" ? <Magnet className="size-4" /> : <FileUp className="size-4" />}
                  {mode === "magnet" ? "Add Magnet" : "Upload Torrent"}
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
  );
}
