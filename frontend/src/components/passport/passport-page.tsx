import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Download, Search, Check, ChevronDown, RotateCcw,
  Sparkles, Zap, Image as ImageIcon, Loader2, IdCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";

const fastSpring = { type: "spring" as const, stiffness: 400, damping: 30 };
const softSpring = { type: "spring" as const, stiffness: 200, damping: 25 };
const checkerStyle: React.CSSProperties = {
  backgroundImage: `repeating-conic-gradient(rgba(0,0,0,0.035) 0% 25%, transparent 0% 50%)`,
  backgroundSize: "16px 16px",
};

interface CountrySpec {
  country: string;
  code: string;
  region: string;
  width_mm: number;
  height_mm: number;
  width_px: number;
  height_px: number;
  dpi: number;
  bg_color: string;
  bg_color_name: string;
  emoji: string;
  notes: string | null;
}

const COLOR_PRESETS = [
  { hex: "#ffffff", label: "White" },
  { hex: "#f0f5ff", label: "Ice" },
  { hex: "#dbeafe", label: "Sky" },
  { hex: "#f3f4f6", label: "Gray" },
  { hex: "#fef3cd", label: "Cream" },
  { hex: "#fce4ec", label: "Blush" },
  { hex: "#e8e0ff", label: "Lavender" },
];

const FORMAT_OPTIONS = [
  { value: "png" as const, label: "PNG", desc: "Best quality" },
  { value: "jpg" as const, label: "JPEG", desc: "Smaller file" },
  { value: "webp" as const, label: "WebP", desc: "Modern format" },
];

export function PassportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const formatRef = useRef<HTMLDivElement>(null);

  const [countries, setCountries] = useState<CountrySpec[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCode, setSelectedCode] = useState("US");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "webp">("png");
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    fetch("/api/passport/sizes")
      .then((r) => r.json())
      .then((data) => {
        setCountries(data);
        const us = data.find((c: CountrySpec) => c.code === "US");
        if (us) setBgColor(us.bg_color);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!preview) return;
    const img = document.createElement("img");
    img.onload = () => setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = preview;
  }, [preview]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (formatRef.current && !formatRef.current.contains(e.target as Node)) {
        setShowFormatMenu(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCountryDropdown(false);
        setShowFormatMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.code === selectedCode) ?? null,
    [countries, selectedCode],
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase();
    return countries.filter(
      (c) =>
        c.country.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q),
    );
  }, [countries, countrySearch]);

  const groupedCountries = useMemo(() => {
    const groups: Record<string, CountrySpec[]> = {};
    for (const c of filteredCountries) {
      if (!groups[c.region]) groups[c.region] = [];
      groups[c.region].push(c);
    }
    return groups;
  }, [filteredCountries]);

  const updateBgFromCountry = useCallback((code: string) => {
    const c = countries.find((x) => x.code === code);
    if (c) setBgColor(c.bg_color);
  }, [countries]);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) return;
    URL.revokeObjectURL(preview ?? "");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResultUrl(null);
    setResultBlob(null);
    setError(null);
  }, [preview]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleConvert = async () => {
    if (!file || !selectedCountry) return;
    setProcessing(true);
    setError(null);
    setResultUrl(null);
    setResultBlob(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("country_code", selectedCountry.code);
      fd.append("bg_color", bgColor);

      const res = await fetch("/api/passport/convert", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Conversion failed" }));
        throw new Error(err.detail || "Conversion failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!resultBlob) return;
    let blob = resultBlob;
    const ext = exportFormat;

    if (ext === "jpg") {
      const img = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95)
      );
      img.close();
    } else if (ext === "webp") {
      const img = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/webp", 0.95)
      );
      img.close();
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `passport.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    URL.revokeObjectURL(preview ?? "");
    URL.revokeObjectURL(resultUrl ?? "");
    setFile(null);
    setPreview(null);
    setResultUrl(null);
    setResultBlob(null);
    setError(null);
    setDimensions(null);
    setShowCompare(false);
    setShowCountryDropdown(false);
    setShowFormatMenu(false);
  };

  const selectCountry = (code: string) => {
    setSelectedCode(code);
    setShowCountryDropdown(false);
    setCountrySearch("");
    updateBgFromCountry(code);
  };

  const hasFile = !!file;
  const hasResult = !!resultUrl;
  const spec = selectedCountry;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Passport Photos</h1>
        <p className="text-sm text-body mt-0.5">
          Create passport-compliant photos for 30+ countries
        </p>
      </div>

      <div className="bg-card border border-hairline overflow-hidden">
        {!hasFile ? (
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "relative block border-2 border-dashed transition-all duration-500 cursor-pointer overflow-hidden",
              "min-h-[400px] flex items-center justify-center",
              dragOver
                ? "border-ink/40 scale-[1.02]"
                : "border-hairline hover:border-body/30 hover:bg-surface-soft",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
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
                <IdCard className="size-8 text-ink/70" />
              </motion.div>
              <div className="text-center">
                <p className="font-semibold text-base">Upload a portrait photo</p>
                <p className="text-sm text-mute mt-1">or click to browse · PNG, JPEG, WebP</p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                {[
                  { icon: Sparkles, label: "Face Detection" },
                  { icon: Zap, label: "Instant" },
                  { icon: ImageIcon, label: "30+ Countries" },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5 text-[10px] text-mute font-medium tracking-wider uppercase px-2 py-1 border border-hairline rounded-sm">
                    <f.icon className="size-2.5" />
                    {f.label}
                  </div>
                ))}
              </div>
            </motion.div>
          </label>
        ) : (
          <>
            {/* Preview canvas */}
            <div className="relative min-h-[420px] flex items-center justify-center" style={checkerStyle}>
              {processing ? (
                <div className="relative w-full min-h-[420px] flex items-center justify-center overflow-hidden">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="relative size-12">
                      <span className="absolute inset-0 rounded-full border-2 border-ink/20" />
                      <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-ink animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-ink">Processing your photo...</p>
                      <p className="text-xs text-mute mt-0.5">Detecting face & applying passport spec</p>
                    </div>
                  </motion.div>
                  <motion.div
                    className="absolute inset-x-[15%] h-px bg-gradient-to-r from-transparent via-ink/20 to-transparent"
                    animate={{ top: ["-5%", "105%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
                  />
                </div>
              ) : hasResult ? (
                <div className="relative w-full min-h-[420px] flex items-center justify-center p-8">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={softSpring}
                    className="relative"
                  >
                    <img
                      src={showCompare ? preview! : resultUrl!}
                      alt={showCompare ? "Original" : "Passport photo"}
                      className="max-w-full max-h-[480px] object-contain shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
                      draggable={false}
                    />
                    {/* Specs overlay badge */}
                    {spec && !showCompare && (
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1.5 rounded-sm bg-ink/85 text-on-dark text-[11px] leading-none"
                      >
                        <span className="font-semibold tracking-wider">{spec.width_mm}×{spec.height_mm}mm</span>
                        <span className="opacity-40">|</span>
                        <span>{spec.dpi}DPI</span>
                        <span className="opacity-40">|</span>
                        <span className="capitalize">{bgColor === spec.bg_color ? spec.bg_color_name : "Custom"}</span>
                      </motion.div>
                    )}
                    {/* Original inset badge */}
                    {!showCompare && (
                      <button
                        onClick={() => setShowCompare(true)}
                        className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1.5 rounded-sm bg-canvas/90 border border-hairline text-[10px] text-mute font-medium hover:text-ink transition-colors cursor-pointer"
                      >
                        <span className="size-2 rounded-sm bg-surface-card border border-hairline overflow-hidden shrink-0">
                          <img src={preview!} alt="" className="size-full object-cover" />
                        </span>
                        Original
                      </button>
                    )}
                    {showCompare && (
                      <button
                        onClick={() => setShowCompare(false)}
                        className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1.5 rounded-sm bg-canvas/90 border border-hairline text-[10px] text-mute font-medium hover:text-ink transition-colors cursor-pointer"
                      >
                        <span className="size-2 rounded-sm bg-ink shrink-0" />
                        Result
                      </button>
                    )}
                  </motion.div>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full p-6 min-h-[420px]">
                  <motion.img
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={softSpring}
                    src={preview!}
                    alt="Preview"
                    className="max-w-full max-h-[480px] object-contain"
                    draggable={false}
                  />
                </div>
              )}
            </div>

            {/* Action bar */}
            <AnimatePresence>
              <motion.div
                key="bar"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fastSpring}
                className="border-t border-hairline"
              >
                {/* File info */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-hairline">
                  <div className="size-9 rounded-sm overflow-hidden bg-surface-card shrink-0 border border-hairline">
                    {preview && <img src={preview} alt="" className="size-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink truncate max-w-[200px]">{file?.name}</p>
                    <p className="text-[11px] text-mute flex items-center gap-1">
                      {dimensions && <span>{dimensions.w}×{dimensions.h}</span>}
                      {dimensions && file && <span>·</span>}
                      {file && <span>{formatBytes(file.size)}</span>}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReset}
                    className="size-8 active:scale-[0.95] transition-transform shrink-0"
                    title="Start over"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                  {/* Country selector */}
                  <div className="relative min-w-0 flex-1 basis-[200px]">
                    <label className="block text-[10px] font-medium text-mute uppercase tracking-wider mb-1.5">
                      Country / Region
                    </label>
                    <button
                      onClick={() => setShowCountryDropdown(true)}
                      className={cn(
                        "flex items-center gap-2 w-full h-9 px-3 text-sm rounded-sm border transition-all cursor-pointer",
                        "bg-surface-soft text-ink hover:bg-surface-card",
                        "border-hairline hover:border-body/30",
                      )}
                    >
                      {spec ? (
                        <>
                          <span className="text-base leading-none">{spec.emoji}</span>
                          <span className="flex-1 truncate text-left">{spec.country}</span>
                          <span className="text-[10px] text-mute tabular-nums shrink-0">
                            {spec.width_mm}×{spec.height_mm}
                          </span>
                        </>
                      ) : (
                        <span className="text-mute flex-1 text-left">Select country</span>
                      )}
                      <ChevronDown className="size-3 text-mute" />
                    </button>
                  </div>

                  {/* BG Color */}
                  <div className="min-w-0 flex-shrink-0">
                    <label className="block text-[10px] font-medium text-mute uppercase tracking-wider mb-1.5">
                      Background
                    </label>
                    <div className="flex items-center gap-1.5">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.hex}
                          onClick={() => setBgColor(preset.hex)}
                          className={cn(
                            "size-9 rounded-sm border transition-all cursor-pointer relative flex items-center justify-center",
                            bgColor === preset.hex
                              ? "border-ink scale-110"
                              : "border-hairline hover:border-body/30 hover:scale-105",
                          )}
                          style={{ backgroundColor: preset.hex }}
                          title={preset.label}
                        >
                          {bgColor === preset.hex && (
                            <Check className={cn(
                              "size-3.5",
                              preset.hex === "#ffffff" || preset.hex === "#f0f5ff" || preset.hex === "#fef3cd"
                                ? "text-ink"
                                : "text-white",
                            )} />
                          )}
                        </button>
                      ))}
                      <div className="relative">
                        <input
                          type="color"
                          value={bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
                          className="size-9 rounded-sm border border-hairline cursor-pointer appearance-none bg-transparent p-0.5 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none"
                          title="Custom color"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Convert button */}
                  <div className="flex-shrink-0 self-end">
                    <Button
                      onClick={handleConvert}
                      disabled={processing || !file}
                      size="sm"
                      className="gap-1.5 active:scale-[0.97] transition-transform min-w-[140px]"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <IdCard className="size-3.5" />
                          {hasResult ? "Reconvert" : "Convert to Passport"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Download row */}
                {hasResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="border-t border-hairline"
                  >
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-2 text-[11px] text-mute">
                        <span className="text-ink font-medium">
                          {resultBlob ? formatBytes(resultBlob.size) : "—"}
                        </span>
                        <span className="text-hairline-strong">·</span>
                        <span>
                          {spec?.country} · {spec?.width_mm}×{spec?.height_mm}mm · {spec?.dpi}DPI
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative" ref={formatRef}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFormatMenu(!showFormatMenu)}
                            className="gap-1.5 w-[130px] justify-between active:scale-[0.97] transition-transform"
                          >
                            <span>{exportFormat.toUpperCase()}</span>
                            <ChevronDown className="size-3" />
                          </Button>
                          <AnimatePresence>
                            {showFormatMenu && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 bottom-full mb-1 bg-canvas border border-hairline rounded-sm z-50 py-1 min-w-[130px]"
                              >
                                {FORMAT_OPTIONS.map((opt) => (
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
                                        : "text-body hover:bg-surface-soft",
                                    )}
                                  >
                                    <span className="flex-1">{opt.label}</span>
                                    <span className="text-[10px] text-mute">{opt.desc}</span>
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
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/5 rounded-sm px-4 py-3"
          >
            <span className="size-4 shrink-0 mt-0.5 flex items-center justify-center rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">!</span>
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Country selector modal */}
      <AnimatePresence>
        {showCountryDropdown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-ink/40"
              onClick={() => setShowCountryDropdown(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md bg-canvas border border-hairline rounded-sm flex flex-col overflow-hidden"
            >
              <div className="relative border-b border-hairline shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-mute pointer-events-none" />
                <input
                  autoFocus
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search countries..."
                  className="w-full h-10 pl-9 pr-10 text-sm bg-transparent outline-none placeholder:text-mute"
                />
                <button
                  onClick={() => setShowCountryDropdown(false)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center text-mute hover:text-ink transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 3l8 8M11 3l-8 8" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto max-h-[50vh] py-1">
                {Object.entries(groupedCountries).map(([region, items]) => (
                  <div key={region}>
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-mute uppercase tracking-wider bg-surface-soft/50">
                      {region}
                    </div>
                    {items.map((c) => {
                      const active = selectedCode === c.code;
                      return (
                        <button
                          key={c.code}
                          onClick={() => selectCountry(c.code)}
                          className={cn(
                            "flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors",
                            active
                              ? "bg-surface-soft text-ink"
                              : "text-body hover:bg-surface-soft",
                          )}
                        >
                          <span className="text-base leading-none w-6 text-center shrink-0">{c.emoji}</span>
                          <span className="flex-1 truncate">{c.country}</span>
                          <span className="text-[11px] text-mute tabular-nums shrink-0">
                            {c.width_mm}×{c.height_mm}mm
                          </span>
                          {active && <Check className="size-3.5 text-ink shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {filteredCountries.length === 0 && (
                  <div className="px-4 py-12 text-center text-sm text-mute">
                    No countries match "{countrySearch}"
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
