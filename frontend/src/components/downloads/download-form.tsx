import { useState, useEffect, useRef } from "react";
import { Download, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Format {
  format_id: string;
  height: number;
  width: number;
  ext: string;
  filesize: number | null;
  vcodec: string;
  acodec: string;
  fps: number | null;
  vbr: number | null;
  abr: number | null;
  label: string;
}

interface DownloadFormProps {
  onSubmit: (url: string, quality: string, removeWatermark?: boolean) => Promise<void>;
  isSubmitting: boolean;
}

const WATERMARK_PLATFORMS = ["tiktok", "instagram"];

function detectPlatform(url: string): string | null {
  const lower = url.toLowerCase();
  if (/tiktok\.com/.test(lower)) return "tiktok";
  if (/instagram\.com/.test(lower)) return "instagram";
  if (/youtube\.com|youtu\.be/.test(lower)) return "youtube";
  if (/x\.com|twitter\.com/.test(lower)) return "twitter";
  return null;
}

export function DownloadForm({ onSubmit, isSubmitting }: DownloadFormProps) {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState("");
  const [removeWatermark, setRemoveWatermark] = useState(false);
  const [formats, setFormats] = useState<Format[]>([]);
  const [loadingFormats, setLoadingFormats] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isValidUrl = url.trim().length > 0;
  const platform = detectPlatform(url);
  const showWatermarkToggle = platform && WATERMARK_PLATFORMS.includes(platform);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!isValidUrl) {
      setFormats([]);
      setQuality("");
      setFormatError(null);
      return;
    }

    setLoadingFormats(true);
    setFormatError(null);

    const abort = new AbortController();

    debounceRef.current = setTimeout(async () => {
      const timeout = setTimeout(() => abort.abort(), 15000);

      try {
        const res = await fetch("/api/formats", {
          signal: abort.signal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
        clearTimeout(timeout);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to load formats");
        }
        const data: Format[] = await res.json();
        setFormats(data);
        if (data.length > 0 && !quality) {
          setQuality(data[0].format_id);
        }
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof DOMException && err.name === "AbortError") {
          setFormatError("Timed out loading formats. Try again?");
        } else {
          setFormatError(err instanceof Error ? err.message : "Failed to load formats");
        }
        setFormats([]);
      } finally {
        setLoadingFormats(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abort.abort();
    };
  }, [url]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !quality) return;
    await onSubmit(url, quality, removeWatermark);
    setUrl("");
    setFormats([]);
    setQuality("");
    setRemoveWatermark(false);
  };

  const selectedFormat = formats.find((f) => f.format_id === quality);

  const handleRetry = () => {
    if (!isValidUrl) return;
    setLoadingFormats(true);
    setFormatError(null);
    fetch("/api/formats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: Format[]) => {
        setFormats(data);
        if (data.length > 0 && !quality) setQuality(data[0].format_id);
      })
      .catch(() => setFormatError("Failed to load formats"))
      .finally(() => setLoadingFormats(false));
  };

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label htmlFor="url-input" className="text-sm font-medium text-foreground">
              Video URL
            </label>
            <Input
              id="url-input"
              type="url"
              placeholder="Paste video URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="flex-1"
            />
          </div>

          {/* Format selector */}
          {isValidUrl && (
            <div className="space-y-1.5" ref={dropdownRef}>
              <label className="text-sm font-medium text-foreground">
                Quality
              </label>

              {loadingFormats && (
                <div className="flex items-center gap-2 h-10 px-4 rounded-lg border border-border/60 bg-input/30 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading formats...
                </div>
              )}

              {formatError && !loadingFormats && (
                <div className="flex items-center gap-2 h-10 px-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate">{formatError}</span>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="ml-auto shrink-0 hover:text-destructive/80"
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                </div>
              )}

              {!loadingFormats && !formatError && formats.length === 0 && (
                <div className="flex items-center h-10 px-4 rounded-lg border border-border/60 bg-input/30 text-sm text-muted-foreground">
                  No formats found
                </div>
              )}

              {!loadingFormats && formats.length > 0 && (
                <>
                  {/* Custom dropdown trigger */}
                  <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className={cn(
                      "flex h-10 w-full items-center justify-between rounded-lg border border-border/60 bg-input/30 px-4 py-2 text-sm transition-[color,box-shadow,border-color]",
                      "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                      "cursor-pointer"
                    )}
                  >
                    <span className="truncate">
                      {selectedFormat ? selectedFormat.label : "Select quality"}
                    </span>
                    <svg
                      className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {/* Dropdown list */}
                  {open && (
                    <div className="relative">
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-border/60 bg-card shadow-lg max-h-60 overflow-auto">
                        {formats.map((fmt) => {
                          const isVideo = fmt.vcodec && fmt.vcodec !== "none";
                          const isSelected = quality === fmt.format_id;
                          return (
                            <button
                              key={fmt.format_id}
                              type="button"
                              onClick={() => {
                                setQuality(fmt.format_id);
                                setOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors cursor-pointer",
                                "hover:bg-accent",
                                isSelected && "bg-accent font-medium"
                              )}
                            >
                              <span className="flex-1 min-w-0 truncate">
                                {isVideo && fmt.height >= 1080 && (
                                  <span className={cn(
                                    "inline-block shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none mr-2",
                                    fmt.height >= 2160
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  )}>
                                    {fmt.height >= 2160 ? "4K" : fmt.height >= 1440 ? "2K" : "HD"}
                                  </span>
                                )}
                                {fmt.label}
                              </span>
                              {fmt.filesize ? (
                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                  {(fmt.filesize / 1024 / 1024).toFixed(0)}MB
                                </span>
                              ) : (
                                <span className="shrink-0 text-xs text-muted-foreground">—</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Watermark toggle */}
          {showWatermarkToggle && (
            <label className="flex items-center gap-3 py-1 cursor-pointer group">
              <button
                type="button"
                onClick={() => setRemoveWatermark(!removeWatermark)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  removeWatermark ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
                    removeWatermark ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
              <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                Remove {platform === "tiktok" ? "TikTok" : "Instagram"} watermark
              </span>
            </label>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isSubmitting || !url.trim() || !quality || loadingFormats}
              size="lg"
              className={cn(
                "flex-1",
                !loadingFormats && formats.length === 0 && !formatError && isValidUrl && "opacity-50"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Download
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
