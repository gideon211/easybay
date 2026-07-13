import { motion } from "motion/react";
import { Download, Magnet, Image, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

interface LandingPageProps {
  onContinue: () => void;
}

function EasyBayLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="36" height="36" rx="4" fill="currentColor" />
      <path
        d="M10 10.5h10.5c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2H12.5v1.5h7c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2H10v-9.5z"
        fill="var(--canvas)"
        opacity="0.95"
      />
      <path
        d="M24 17v7.5c0 .8-.7 1.5-1.5 1.5h-1c-.8 0-1.5-.7-1.5-1.5V17l-2.5 2.5c-.6.6-1.5.6-2.1 0l-.7-.7c-.6-.6-.6-1.5 0-2.1l5.3-5.3c.3-.3.6-.4 1-.4s.7.1 1 .4l5.3 5.3c.6.6.6 1.5 0 2.1l-.7.7c-.6.6-1.5.6-2.1 0L24 17z"
        fill="var(--canvas)"
        opacity="0.95"
      />
    </svg>
  );
}

const features = [
  {
    icon: Download,
    title: "Platform Downloads",
    desc: "YouTube, TikTok, Instagram, Twitter",
  },
  {
    icon: Image,
    title: "Image Tools",
    desc: "Background removal, passport photos, SVG",
  },
  {
    icon: Magnet,
    title: "Torrent Support",
    desc: "Add magnets or .torrent files",
  },
];

export function LandingPage({ onContinue }: LandingPageProps) {
  return (
    <div className="relative h-screen flex flex-col items-center justify-center bg-canvas text-ink px-6 overflow-hidden transition-colors duration-200">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-10 max-w-lg w-full">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <EasyBayLogo className="size-16 text-ink" />
          </motion.div>
        </motion.div>

        {/* Text */}
        <div className="text-center space-y-3">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-2xl font-semibold tracking-tight"
          >
            EasyBay
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-sm text-body leading-relaxed max-w-sm mx-auto"
          >
            Download videos, manage torrents, and process images — all in one place.
          </motion.p>
        </div>

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row gap-2 w-full"
        >
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2 flex-1 px-4 py-3 sm:py-4 border border-hairline rounded-sm bg-surface-card"
              >
                <div className="size-9 rounded-sm bg-surface-soft border border-hairline flex items-center justify-center shrink-0">
                  <Icon className="size-4 text-ink" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink">{f.title}</p>
                  <p className="text-[10px] text-mute mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Continue button */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <Button
            onClick={onContinue}
            size="lg"
            className="w-full gap-2 text-sm active:scale-[0.97] transition-transform"
          >
            <span>Continue to Dashboard</span>
            <ArrowRight className="size-4" />
          </Button>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="fixed bottom-6 text-[11px] text-mute"
      >
        EasyBay v0.1.0
      </motion.p>
    </div>
  );
}
