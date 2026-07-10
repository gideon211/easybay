import { useState, useEffect, useRef } from "react";
import { Download, Loader2, AlertCircle, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface QuickAddProps {
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

export function QuickAdd({ onSubmit, isSubmitting }: QuickAddProps) {
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
  const showWatermark = platform && WATERMARK_PLATFORMS.includes(platform);

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
        if (data.length > 0 && !quality) setQuality(data[0].format_id);
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof DOMException && err.name === "AbortError") {
          setFormatError("Timed out");
        } else {
          setFormatError(err instanceof Error ? err.message : "Failed");
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

  return (
    <div className="bg-card border border-hairline p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Plus className="size-4 text-ink" />
        <h3 className="text-sm font-semibold">Quick Add</h3>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Input
              type="url"
              placeholder="Paste URL from YouTube, TikTok, Instagram, Twitter(X)..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pr-10 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {loadingFormats && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="size-4 animate-spin text-mute" />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative w-36" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => formats.length > 0 && setOpen(!open)}
                disabled={formats.length === 0}
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-sm border border-hairline bg-surface-soft px-3 text-sm transition-colors",
                  "focus-visible:border-ink",
                  formats.length === 0 && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className="truncate text-xs">
                  {selectedFormat ? selectedFormat.label.split("·")[0].trim() : loadingFormats ? "Loading..." : "1080p"}
                </span>
                {formats.length > 0 && (
                  <svg
                    className={cn("size-3.5 shrink-0 text-mute transition-transform ml-1", open && "rotate-180")}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                )}
              </button>
              {open && formats.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-sm border border-hairline bg-canvas max-h-48 overflow-auto">
                  {formats.map((fmt) => (
                    <button
                      key={fmt.format_id}
                      type="button"
                      onClick={() => { setQuality(fmt.format_id); setOpen(false); }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                        "hover:bg-surface-soft",
                        quality === fmt.format_id && "bg-surface-soft font-medium"
                      )}
                    >
                      <span className="flex-1 min-w-0 truncate">{fmt.label}</span>
                      {fmt.filesize ? (
                        <span className="shrink-0 text-mute tabular-nums">
                          {(fmt.filesize / 1024 / 1024).toFixed(0)}MB
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !url.trim() || !quality || loadingFormats}
              size="default"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Download className="size-4" />
                  <span className="hidden sm:inline">Download</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {formatError && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="size-3 shrink-0" />
            <span className="flex-1">{formatError}</span>
            <button type="button" onClick={() => setFormatError(null)} className="hover:text-destructive/80">
              <RefreshCw className="size-3" />
            </button>
          </div>
        )}

        {/* Chips */}
        <div className="flex flex-wrap gap-2">
          {showWatermark && (
            <button
              type="button"
              onClick={() => setRemoveWatermark(!removeWatermark)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors",
                removeWatermark
                  ? "bg-ink/[0.06] text-ink border-ink/30"
                  : "bg-surface-card text-mute border-hairline hover:text-ink"
              )}
            >
              Remove Watermark
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border bg-surface-card text-mute border-hairline hover:text-ink transition-colors"
          >
            Audio Only
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border bg-surface-card text-mute border-hairline hover:text-ink transition-colors"
          >
            Subtitles
          </button>
        </div>
      </form>
    </div>
  );
}
