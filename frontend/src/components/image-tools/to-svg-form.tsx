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

  const updateSliderPosition = useCallback((clientX: number) => {
    const bounds = sliderRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = Math.max(0, Math.min(clientX - bounds.left, bounds.width));
    setSliderPos((x / bounds.width) * 100);
  }, []);

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
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) handleFile(selected);
                  e.currentTarget.value = "";
                }}
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
              className={cn(
                "relative w-full h-[min(560px,65vh)] min-h-[400px] select-none overflow-hidden",
                hasResult && "cursor-ew-resize touch-none",
              )}
              onPointerDown={(event) => {
                if (!hasResult) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                updateSliderPosition(event.clientX);
              }}
              onPointerMove={(event) => {
                if (!hasResult || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                updateSliderPosition(event.clientX);
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              role={hasResult ? "slider" : undefined}
              aria-label={hasResult ? "Compare original image with SVG result" : undefined}
              aria-valuemin={hasResult ? 0 : undefined}
              aria-valuemax={hasResult ? 100 : undefined}
              aria-valuenow={hasResult ? Math.round(sliderPos) : undefined}
              tabIndex={hasResult ? 0 : undefined}
              onKeyDown={(event) => {
                if (!hasResult) return;
                if (event.key === "ArrowLeft") setSliderPos((position) => Math.max(0, position - 2));
                if (event.key === "ArrowRight") setSliderPos((position) => Math.min(100, position + 2));
              }}
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
              <div className="absolute inset-0 z-10">
                {hasResult && (
                  <img
                    src={resultUrl}
                    alt="SVG result"
                    className="size-full object-contain p-4"
                    draggable={false}
                  />
                )}
                {!hasResult && !isProcessing && preview && (
                  <img
                    src={preview}
                    alt="Original"
                    className="size-full object-contain p-4"
                    draggable={false}
                  />
                )}
              </div>

              {/* Original (clipped left overlay) */}
              {preview && !isProcessing && (
                <div
                  className="absolute inset-0 z-20 overflow-hidden"
                  style={{ clipPath: `inset(0 ${hasResult ? 100 - sliderPos : 0}% 0 0)` }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: "linear-gradient(45deg, hsl(var(--surface-card) / 0.6) 25%, transparent 25%, transparent 75%, hsl(var(--surface-card) / 0.6) 75%, hsl(var(--surface-card) / 0.6)), linear-gradient(45deg, hsl(var(--surface-card) / 0.6) 25%, transparent 25%, transparent 75%, hsl(var(--surface-card) / 0.6) 75%, hsl(var(--surface-card) / 0.6))",
                      backgroundSize: "20px 20px",
                      backgroundPosition: "0 0, 10px 10px",
                    }}
                  />
                  <div className="absolute inset-0 z-10">
                    <img
                      src={preview}
                      alt="Original"
                      className="size-full object-contain p-4"
                      draggable={false}
                    />
                  </div>
                </div>
              )}

              {/* Slider handle */}
              {hasResult && (
                <div
                  className="absolute top-0 bottom-0 z-30 pointer-events-none"
                  style={{ left: `${sliderPos}%`, width: "2px" }}
                >
                  <div className="h-full w-full bg-info shadow-[0_0_12px_rgba(10,132,255,0.55)]" />
                  <motion.div
                    whileHover={{ scale: 1.06 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-11 rounded-full bg-canvas border-2 border-info flex items-center justify-center shadow-[0_4px_18px_rgba(0,0,0,0.28)]"
                  >
                    <ArrowLeftRight className="size-4 text-info" />
                  </motion.div>
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
                  className="absolute inset-0 z-40 overflow-hidden bg-canvas/25 backdrop-blur-[1px]"
                >
                  <motion.div
                    className="absolute inset-x-[8%] h-20 bg-gradient-to-b from-transparent via-info/15 to-transparent"
                    animate={{ top: ["-15%", "110%"] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
                  />
                  <motion.div
                    className="absolute inset-x-[8%] h-px bg-info shadow-[0_0_18px_rgba(10,132,255,0.85)]"
                    animate={{ top: ["-5%", "105%"] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
                  />
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-sm border border-info/30 bg-canvas/90 px-4 py-2 backdrop-blur-md">
                    <motion.div animate={{ scale: [0.92, 1.08, 0.92] }} transition={{ duration: 1.4, repeat: Infinity }}>
                      <FileCode className="size-4 text-info" />
                    </motion.div>
                    <p className="text-xs font-medium text-ink">Tracing editable vector paths...</p>
                  </div>
                </motion.div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
