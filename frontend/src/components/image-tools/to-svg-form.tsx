import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, Download, FileCode, XCircle, ArrowLeftRight, RotateCcw, Sparkles, Zap, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";
import { convertToSvg } from "@/lib/api";

type Status = "idle" | "processing" | "done" | "error";

export function ToSvgForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) return;
    URL.revokeObjectURL(preview ?? "");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResultUrl(null);
    setError("");
    setStatus("idle");
    setSliderPos(50);
  }, [preview]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSubmit = async () => {
    if (!file) return;
    setStatus("processing");
    setError("");
    try {
      const blob = await convertToSvg(file);
      URL.revokeObjectURL(resultUrl ?? "");
      setResultUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResultUrl(null);
    setStatus("idle");
    setError("");
    setSliderPos(50);
  };

  const isProcessing = status === "processing";
  const hasResult = status === "done" && resultUrl;
  const hasFile = !!file;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
      {/* Left panel — toolbox */}
      <div className="space-y-4">
        {/* Compact dropzone */}
        <div className="bg-card border border-hairline">
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isProcessing && inputRef.current?.click()}
              className={cn(
                "relative block border border-dashed rounded-sm transition-all duration-300 cursor-pointer overflow-hidden",
                "min-h-[140px] flex items-center justify-center",
                dragOver && "border-ink/50",
                hasFile && !dragOver && !isProcessing && "border-ink/20",
                isProcessing && "pointer-events-none opacity-70",
                !hasFile && !dragOver && "border-hairline hover:border-body/30 hover:bg-surface-soft",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                disabled={isProcessing}
              />

              {!hasFile ? (
                <div className="flex flex-col items-center gap-2 text-body p-5">
                  <Upload className="size-6" />
                  <span className="text-sm font-medium">Drop or browse</span>
                  <span className="text-[11px] text-mute">PNG, JPEG, WebP, BMP</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3">
                  {preview && (
                    <div className="size-10 rounded-sm overflow-hidden bg-surface-card shrink-0">
                      <img src={preview} alt="" className="size-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{file?.name}</p>
                    <p className="text-[11px] text-mute">{file && formatBytes(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    className="ml-auto text-[11px] text-destructive hover:underline shrink-0"
                    disabled={isProcessing}
                  >
                    Remove
                  </button>
                </div>
              )}
            </label>
        </div>

        {/* Actions */}
        <AnimatePresence>
          {hasFile && (
            <motion.div
              key="actions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-2"
            >
              <Button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="w-full gap-2"
              >
                {isProcessing ? (
                  <>
                    <span className="relative size-4">
                        <span className="absolute inset-0 rounded-sm border-2 border-canvas/20 border-t-on-dark animate-spin" />
                    </span>
                    Converting...
                  </>
                ) : (
                  <>
                    <FileCode className="size-4" />
                    {hasResult ? "Convert Again" : "Convert to SVG"}
                  </>
                )}
              </Button>

              {hasResult && (
                <div className="flex gap-2">
                  <a href={resultUrl ?? undefined} download="image.svg" className="flex-1">
                    <Button variant="outline" className="w-full gap-2">
                      <Download className="size-4" />
                      Download SVG
                    </Button>
                  </a>
                  <Button variant="ghost" size="icon" onClick={handleReset} className="size-9 shrink-0">
                    <RotateCcw className="size-4" />
                  </Button>
                </div>
              )}

              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-body justify-center py-1">
                  <span className="relative size-3">
                    <span className="absolute inset-0 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
                  </span>
                  Processing...
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="error-tooltip"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 rounded-sm px-4 py-3"
            >
              <XCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right panel — canvas / comparison */}
      <div className="bg-card border border-hairline h-fit lg:sticky lg:top-6 min-h-[400px] flex items-center justify-center overflow-hidden">
          {!hasFile ? (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 text-mute/40 p-8"
            >
              <div className="size-20 rounded-sm bg-surface-card flex items-center justify-center">
                <FileCode className="size-10" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-mute/60">Waiting for input</p>
                <p className="text-xs text-mute/40 mt-1 max-w-[240px]">
                  Upload an image on the left to see the SVG conversion preview
                </p>
              </div>
              <div className="flex items-center gap-4 mt-2">
                {[
                  { icon: Sparkles, label: "Scalable" },
                  { icon: Zap, label: "Adjustable" },
                  { icon: ImageIcon, label: "Compact" },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5 text-[11px] text-mute/30">
                    <f.icon className="size-3" />
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div
              ref={sliderRef}
              className="relative w-full min-h-[400px] max-h-[560px] select-none"
              onMouseDown={() => { isDragging.current = true; }}
              onMouseMove={(e) => {
                if (!isDragging.current || !sliderRef.current) return;
                const rect = sliderRef.current.getBoundingClientRect();
                const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                setSliderPos((x / rect.width) * 100);
              }}
              onMouseUp={() => { isDragging.current = false; }}
              onMouseLeave={() => { isDragging.current = false; }}
            >
              {/* Checkerboard for transparency */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: "linear-gradient(45deg, hsl(var(--surface-card)) 25%, transparent 25%, transparent 75%, hsl(var(--surface-card)) 75%, hsl(var(--surface-card))), linear-gradient(45deg, hsl(var(--surface-card)) 25%, transparent 25%, transparent 75%, hsl(var(--surface-card)) 75%, hsl(var(--surface-card)))",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 10px 10px",
                }}
              />

              {/* Result (base) */}
              <div className="relative z-10 flex items-center justify-center min-h-[400px]">
                {hasResult && (
                  <img
                    src={resultUrl}
                    alt="SVG result"
                    className="max-w-full max-h-[520px] object-contain"
                    draggable={false}
                  />
                )}
                {!hasResult && !isProcessing && preview && (
                  <img
                    src={preview}
                    alt="Original"
                    className="max-w-full max-h-[520px] object-contain"
                    draggable={false}
                  />
                )}
              </div>

              {/* Original (clipped left overlay) */}
              {preview && !isProcessing && (
                <div
                  className="absolute inset-0 z-20 overflow-hidden"
                  style={{ width: `${hasResult ? sliderPos : 100}%` }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: "linear-gradient(45deg, hsl(var(--surface-card) / 0.6) 25%, transparent 25%, transparent 75%, hsl(var(--surface-card) / 0.6) 75%, hsl(var(--surface-card) / 0.6)), linear-gradient(45deg, hsl(var(--surface-card) / 0.6) 25%, transparent 25%, transparent 75%, hsl(var(--surface-card) / 0.6) 75%, hsl(var(--surface-card) / 0.6))",
                      backgroundSize: "20px 20px",
                      backgroundPosition: "0 0, 10px 10px",
                    }}
                  />
                  <div className="relative z-10 flex items-center justify-center min-h-[400px]">
                    <img
                      src={preview}
                      alt="Original"
                      className="max-w-full max-h-[520px] object-contain"
                      draggable={false}
                    />
                  </div>
                </div>
              )}

              {/* Slider handle */}
              {hasResult && (
                <div
                  className="absolute top-0 bottom-0 z-30"
                  style={{ left: `${sliderPos}%`, width: "2px" }}
                >
                  <div className="h-full w-full bg-canvas/90" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-10 rounded-sm bg-canvas border border-hairline flex items-center justify-center">
                    <ArrowLeftRight className="size-4 text-mute" />
                  </div>
                </div>
              )}

              {/* Labels */}
              <div className="absolute top-4 left-4 z-30">
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-sm bg-ink/70 text-on-dark">
                  Original
                </span>
              </div>
              <div className="absolute top-4 right-4 z-30">
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-sm bg-ink/70 text-on-dark">
                  {hasResult ? "SVG" : "Preview"}
                </span>
              </div>

              {/* Processing overlay */}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-canvas/30"
                >
                  <div className="relative size-12">
                    <div className="absolute inset-0 rounded-sm border-2 border-ink/20" />
                    <div className="absolute inset-0 rounded-sm border-[3px] border-ink/20 border-t-ink animate-spin" />
                    <div className="absolute inset-[5px] rounded-sm bg-ink/5 flex items-center justify-center">
                      <FileCode className="size-4 text-ink" />
                    </div>
                  </div>
                  <p className="text-sm text-body">Converting to SVG...</p>
                </motion.div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
