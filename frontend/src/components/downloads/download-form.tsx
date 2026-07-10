import { useState, useEffect, useRef } from "react";
import { Download, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (data.length > 0) setQuality(data[0].format_id);
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof DOMException && err.name === "AbortError") {
          setFormatError("Timed out. Try again?");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !quality) return;
    await onSubmit(url, quality, removeWatermark);
    setUrl("");
    setFormats([]);
    setQuality("");
    setRemoveWatermark(false);
  };

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
        if (data.length > 0) setQuality(data[0].format_id);
      })
      .catch(() => setFormatError("Failed to load formats"))
      .finally(() => setLoadingFormats(false));
  };

  const formatOptions = formats.map((f) => ({
    value: f.format_id,
    label: f.label,
  }));

  const showQualitySelector = isValidUrl && !loadingFormats && !formatError && formats.length > 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="url"
              placeholder="Paste video URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="flex-1 min-w-0"
            />

            {isValidUrl && (
              <div className="sm:w-44 shrink-0">
                {loadingFormats && (
                  <div className="flex items-center gap-2 h-10 px-3 rounded-sm border border-hairline bg-surface-soft text-sm text-mute">
                    <Loader2 className="size-3.5 animate-spin shrink-0" />
                    <span className="truncate">Loading formats...</span>
                  </div>
                )}

                {formatError && !loadingFormats && (
                  <div className="flex items-center gap-2 h-10 px-3 rounded-sm border border-destructive/20 bg-destructive/5 text-sm text-destructive">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span className="flex-1 truncate">{formatError}</span>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="shrink-0 hover:text-destructive transition-colors"
                    >
                      <RefreshCw className="size-3.5" />
                    </button>
                  </div>
                )}

                {!loadingFormats && !formatError && formats.length === 0 && (
                  <div className="flex items-center h-10 px-3 rounded-sm border border-hairline bg-surface-soft text-sm text-mute">
                    No formats found
                  </div>
                )}

                {showQualitySelector && (
                  <Select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    options={formatOptions}
                  />
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !url.trim() || !quality || loadingFormats}
              className="shrink-0"
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

          {showWatermarkToggle && (
            <label className="flex items-center gap-2 text-sm text-mute cursor-pointer select-none">
              <input
                type="checkbox"
                checked={removeWatermark}
                onChange={(e) => setRemoveWatermark(e.target.checked)}
                className="size-4 rounded-sm border-hairline accent-ink"
              />
              Remove {platform === "tiktok" ? "TikTok" : "Instagram"} watermark
            </label>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
