import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, Download, Eraser, ArrowLeftRight, XCircle, Clock, RotateCcw, Sparkles, Zap, Image as ImageIcon, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";
import { useRemoveBg } from "@/hooks/use-remove-bg";

const fastSpring = { type: "spring" as const, stiffness: 400, damping: 30 };
const softSpring = { type: "spring" as const, stiffness: 200, damping: 25 };
const checkerStyle: React.CSSProperties = {
  backgroundImage: `repeating-conic-gradient(rgba(0,0,0,0.035) 0% 25%, transparent 0% 50%)`,
  backgroundSize: "16px 16px",
};

export function RemoveBgForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const { state: bg, start, getResultUrl, reset } = useRemoveBg();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [exportFormat, setExportFormat] = useState<"png" | "webp" | "svg">("png");
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const formatMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!preview) return;
    const img = document.createElement("img");
    img.onload = () => setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = preview;
  }, [preview]);

  const updateSliderPosition = useCallback((clientX: number) => {
    const bounds = sliderRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = Math.max(0, Math.min(clientX - bounds.left, bounds.width));
    setSliderPos((x / bounds.width) * 100);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (formatMenuRef.current && !formatMenuRef.current.contains(e.target as Node)) {
        setShowFormatMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) return;
    URL.revokeObjectURL(preview ?? "");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResultUrl(null);
    setResultSize(null);
    reset();
    setSliderPos(50);
  }, [preview, reset]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSubmit = async () => {
    if (!file) return;
    try {
      await start(file);
      const url = getResultUrl();
      if (url) {
        const res = await fetch(url);
        const blob = await res.blob();
        setResultSize(blob.size);
        setResultUrl(URL.createObjectURL(blob));
      }
    } catch {
      // Error is handled by hook state
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResultUrl(null);
    setResultSize(null);
    reset();
    setDimensions(null);
    setSliderPos(50);
    setExportFormat("png");
    setShowFormatMenu(false);
  };

  const handleDownload = async () => {
    const baseUrl = getResultUrl();
    if (!baseUrl) return;
    const res = await fetch(`${baseUrl}?format=${exportFormat}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nobg.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isProcessing = bg.status === "processing";
  const hasResult = bg.status === "complete" && resultUrl;
  const hasFile = !!file;

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const savings = file && resultSize ? Math.round((1 - resultSize / file.size) * 100) : null;

  return (
    <div className="space-y-4">
      {/* Hero canvas */}
      <div className="bg-card border border-hairline overflow-hidden">
        {/* Dropzone (no file) */}
        {!hasFile && (
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "relative block border-2 border-dashed transition-all duration-500 cursor-pointer overflow-hidden",
              "min-h-[360px] flex items-center justify-center",
              dragOver
                ? "border-ink/40 scale-[1.02]"
                : "border-hairline hover:border-body/30 hover:bg-surface-soft",
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
                // Clearing the native value lets selecting the same file again fire change,
                // which is important after Reset or after correcting a failed conversion.
                e.currentTarget.value = "";
              }}
            />
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 text-body p-8"
            >
              <motion.div
                animate={dragOver
                  ? { y: -8, scale: 1.15 }
                  : { y: [0, -4, 0] }
                }
                transition={dragOver ? fastSpring : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="size-20 rounded-sm bg-surface-card flex items-center justify-center"
              >
                <Upload className="size-8 text-ink/70" />
              </motion.div>
              <div className="text-center">
                <p className="font-semibold text-base">Drop an image here</p>
                <p className="text-sm text-mute mt-1">or click to browse · PNG, JPEG, WebP</p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                {[
                  { icon: Sparkles, label: "Transparent" },
                  { icon: Zap, label: "Instant" },
                  { icon: ImageIcon, label: "PNG · WebP · SVG" },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5 text-[10px] text-mute font-medium tracking-wider uppercase px-2 py-1 border border-hairline rounded-sm">
                    <f.icon className="size-2.5" />
                    {f.label}
                  </div>
                ))}
              </div>
            </motion.div>
          </label>
        )}

        {/* Preview / before-after canvas */}
        {hasFile && (
          <div className="relative min-h-[420px] flex items-center justify-center" style={checkerStyle}>
            {/* Before/after slider when result exists */}
            {(hasResult || isProcessing) && preview ? (
              <div
                ref={sliderRef}
                className={cn(
                  "relative w-full h-[min(560px,65vh)] min-h-[420px] select-none overflow-hidden",
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
                aria-label={hasResult ? "Compare original and background-removed image" : undefined}
                aria-valuemin={hasResult ? 0 : undefined}
                aria-valuemax={hasResult ? 100 : undefined}
                aria-valuenow={hasResult ? Math.round(sliderPos) : undefined}
                tabIndex={hasResult ? 0 : undefined}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") setSliderPos((position) => Math.max(0, position - 2));
                  if (event.key === "ArrowRight") setSliderPos((position) => Math.min(100, position + 2));
                }}
              >
                {/* Result (base layer) */}
                {hasResult && (
                  <img
                    src={resultUrl}
                    alt="Processed"
                    className="absolute inset-0 size-full object-contain p-4"
                    draggable={false}
                  />
                )}
                {!hasResult && (
                  <img
                    src={preview}
                    alt="Original"
                    className="absolute inset-0 size-full object-contain p-4 opacity-50"
                    draggable={false}
                  />
                )}

                {/* Original (clipped left) */}
                {hasResult && (
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                  >
                    <div className="absolute inset-0 bg-canvas" style={checkerStyle}>
                      <img
                        src={preview}
                        alt="Original"
                        className="absolute inset-0 size-full object-contain p-4"
                        draggable={false}
                      />
                    </div>
                  </div>
                )}

                {/* Slider handle */}
                {hasResult && (
                  <div
                    className="absolute top-0 bottom-0 z-10 pointer-events-none"
                    style={{ left: `${sliderPos}%` }}
                  >
                    <div className="h-full w-px bg-ink/30" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-9 rounded-sm bg-canvas border border-hairline-strong flex items-center justify-center shadow-[0_1px_6px_rgba(0,0,0,0.1)]">
                      <ArrowLeftRight className="size-3.5 text-ink" />
                    </div>
                  </div>
                )}

                {/* Labels */}
                {hasResult && (
                  <>
                    <div className="absolute top-3 left-3 z-20">
                      <span className="text-[10px] font-medium tracking-wider uppercase px-2 py-1 rounded-sm bg-ink/80 text-on-dark">
                        Original
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 z-20">
                      <span className="text-[10px] font-medium tracking-wider uppercase px-2 py-1 rounded-sm bg-ink/80 text-on-dark">
                        Processed
                      </span>
                    </div>
                  </>
                )}

                {/* Processing overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 z-20 overflow-hidden">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-canvas/15 backdrop-blur-[1px]"
                    />
                    <motion.div
                      className="absolute inset-x-[8%] h-16 bg-gradient-to-b from-transparent via-info/15 to-transparent"
                      animate={{ top: ["-5%", "105%"] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
                    />
                    <motion.div
                      className="absolute inset-x-[8%] h-px bg-info shadow-[0_0_18px_rgba(10,132,255,0.85)]"
                      animate={{ top: ["-5%", "105%"] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
                    />
                    <div className="absolute inset-4 border border-info/20">
                      <motion.span className="absolute left-0 top-0 h-5 w-px bg-info" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} />
                      <motion.span className="absolute left-0 top-0 h-px w-5 bg-info" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} />
                      <motion.span className="absolute bottom-0 right-0 h-5 w-px bg-info" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                      <motion.span className="absolute bottom-0 right-0 h-px w-5 bg-info" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                    </div>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
                      <div className="flex items-center gap-3 px-4 py-2 rounded-sm bg-canvas/90 border border-info/30 backdrop-blur-md">
                        <span className="flex items-end gap-0.5 h-3" aria-hidden="true">
                          {[0, 1, 2, 3].map((bar) => (
                            <motion.span
                              key={bar}
                              className="w-0.5 bg-info"
                              animate={{ height: [3, 12, 5, 9, 3] }}
                              transition={{ duration: 1, repeat: Infinity, delay: bar * 0.12 }}
                            />
                          ))}
                        </span>
                        <span className="text-xs font-medium text-ink">{bg.label || "Analyzing image..."}</span>
                        <span className="text-[10px] tabular-nums text-info">{bg.progress}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Static preview */
              <div className="flex items-center justify-center w-full p-6 min-h-[420px]">
                <motion.img
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={softSpring}
                  src={preview ?? undefined}
                  alt="Preview"
                  className="max-w-full max-h-[480px] object-contain"
                  draggable={false}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating action bar */}
      <AnimatePresence>
        {hasFile && (
          <motion.div
            key="bar"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={fastSpring}
            className="bg-card border border-hairline"
          >
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              {/* File info */}
              <div className="flex items-center gap-3 text-sm text-body min-w-0">
                <div className="size-9 rounded-sm overflow-hidden bg-surface-card shrink-0 border border-hairline">
                  {preview && <img src={preview} alt="" className="size-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink truncate max-w-[160px]">{file?.name}</p>
                  <p className="text-[11px] text-mute flex items-center gap-1">
                    {dimensions && <span>{dimensions.w}×{dimensions.h}</span>}
                    {dimensions && file && <span>·</span>}
                    {file && <span>{formatBytes(file.size)}</span>}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {isProcessing && (
                  <div className="flex items-center gap-3 text-sm text-body mr-1">
                    <motion.span
                      className="h-1 w-5 rounded-full bg-info"
                      animate={{ scaleX: [0.35, 1, 0.35], opacity: [0.45, 1, 0.45] }}
                      transition={{ duration: 1.1, repeat: Infinity }}
                    />
                    <span className="tabular-nums text-xs font-medium">{bg.progress}%</span>
                    <span className="flex items-center gap-1 text-[11px] text-mute">
                      <Clock className="size-3" />
                      {formatTime(bg.elapsed)}
                    </span>
                  </div>
                )}

                {/* Inline progress bar */}
                {isProcessing && (
                  <div className="w-24 h-1 bg-surface-card rounded-full overflow-hidden hidden sm:block">
                    <motion.div
                      className="h-full bg-ink rounded-full relative overflow-hidden"
                      initial={{ width: 0 }}
                      animate={{ width: `${bg.progress}%` }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                    </motion.div>
                  </div>
                )}

                {!isProcessing && (
                  <>
                    {hasResult && (
                      <>
                        <div className="relative" ref={formatMenuRef}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFormatMenu(!showFormatMenu)}
                            className="gap-1.5 min-w-[140px] justify-between active:scale-[0.97] transition-transform"
                          >
                            <span>Export as: {exportFormat.toUpperCase()}</span>
                            <ChevronDown className="size-3" />
                          </Button>
                          <AnimatePresence>
                            {showFormatMenu && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 top-full mt-1 bg-canvas border border-hairline rounded-sm z-50 py-1 min-w-[140px]"
                              >
                                {[
                                  { value: "png" as const, label: "PNG" },
                                  { value: "webp" as const, label: "WebP" },
                                  { value: "svg" as const, label: "SVG" },
                                ].map((opt) => (
                                  <button
                                    key={opt.value}
                                    onClick={() => {
                                      setExportFormat(opt.value);
                                      setShowFormatMenu(false);
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors",
                                      exportFormat === opt.value
                                        ? "text-ink bg-surface-soft"
                                        : "text-body hover:bg-surface-soft"
                                    )}
                                  >
                                    <span className="flex-1">{opt.label}</span>
                                    {exportFormat === opt.value && <Check className="size-3" />}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <Button
                          size="sm"
                          className="gap-1.5 active:scale-[0.97] transition-transform"
                          onClick={handleDownload}
                        >
                          <Download className="size-3.5" />
                          Download
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={handleSubmit}
                      size="sm"
                      className="gap-1.5 active:scale-[0.97] transition-transform"
                    >
                      <Eraser className="size-3.5" />
                      {hasResult ? "Process Again" : "Remove Background"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleReset}
                      className="size-8 active:scale-[0.95] transition-transform"
                      title="Start over"
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Result info row */}
            {(hasResult || isProcessing) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="border-t border-hairline"
              >
                {hasResult && (
                  <div className="px-4 py-2.5">
                    <div className="flex items-center justify-between text-[11px] text-mute">
                      <div className="flex items-center gap-2">
                        <span>
                          Original: <span className="text-ink font-medium">{file ? formatBytes(file.size) : "—"}</span>
                        </span>
                        <span className="text-hairline-strong select-none">→</span>
                        <span>
                          Result: <span className="text-ink font-medium">{resultSize ? formatBytes(resultSize) : "—"}</span>
                        </span>
                        {savings !== null && (
                          <span className="text-mute">({savings}% smaller)</span>
                        )}
                      </div>
                      {dimensions && (
                        <span className="text-mute">{dimensions.w}×{dimensions.h}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Full progress bar during processing */}
                {isProcessing && (
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between text-[11px] text-body mb-1.5">
                      <span className="capitalize tracking-wide">{bg.phase.replace(/_/g, " ")}</span>
                      <span className="tabular-nums font-medium">{bg.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-card rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-ink rounded-full relative overflow-hidden"
                        initial={{ width: 0 }}
                        animate={{ width: `${bg.progress}%` }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                      </motion.div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {bg.status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/5 rounded-sm px-4 py-3"
          >
            <XCircle className="size-4 shrink-0 mt-0.5" />
            <span>{bg.error || "Processing failed"}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
