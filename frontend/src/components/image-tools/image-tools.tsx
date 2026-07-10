import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eraser, FileCode, Sparkles, Zap, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { RemoveBgForm } from "./remove-bg-form";
import { ToSvgForm } from "./to-svg-form";

type SubTab = "remove-bg" | "to-svg";

const subTabs: { id: SubTab; label: string; icon: typeof Eraser; description: string; features: { icon: typeof Sparkles; title: string; desc: string }[] }[] = [
  {
    id: "remove-bg",
    label: "Remove Background",
    icon: Eraser,
    description: "Remove image backgrounds instantly",
    features: [
      { icon: Sparkles, title: "Transparent Output", desc: "Get clean PNG with transparent background" },
      { icon: Zap, title: "Instant Processing", desc: "AI-powered removal in seconds" },
      { icon: Image, title: "Multiple Formats", desc: "PNG, JPEG, WebP, GIF, BMP" },
    ],
  },
  {
    id: "to-svg",
    label: "Convert to SVG",
    icon: FileCode,
    description: "Convert raster images to scalable vector SVG",
    features: [
      { icon: Sparkles, title: "Scalable Vectors", desc: "Infinitely scalable without quality loss" },
      { icon: Zap, title: "Adjustable Quality", desc: "Fine-tune color precision and detail" },
      { icon: Image, title: "Small File Size", desc: "SVGs are often smaller than raster images" },
    ],
  },
];

export function ImageTools() {
  const [subTab, setSubTab] = useState<SubTab>("remove-bg");
  const currentTab = subTabs.find((t) => t.id === subTab)!;

  return (
    <div className="space-y-6">
      {/* Header with inline pill tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Image Tools</h1>
          <p className="text-sm text-body mt-0.5">
            {currentTab.description}
          </p>
        </div>
        <div className="relative flex gap-1 rounded-sm bg-surface-card p-0.5 w-fit shrink-0">
          {subTabs.map((t) => {
            const Icon = t.icon;
            const isActive = subTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={cn(
                  "relative z-10 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm transition-colors duration-200 cursor-pointer",
                  isActive ? "text-ink" : "text-mute hover:text-ink"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="image-subtab-indicator"
                    className="absolute inset-0 rounded-sm bg-canvas"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className="size-4" />
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feature callouts — shown when no file is uploaded */}
      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {subTab === "remove-bg" ? <RemoveBgForm /> : <ToSvgForm />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
