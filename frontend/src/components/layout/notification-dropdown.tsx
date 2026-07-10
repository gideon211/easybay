import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Download,
  Magnet,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Download as DownloadType, Torrent } from "@/lib/api";
import type { Page } from "./sidebar";

interface Props {
  downloads: DownloadType[];
  torrents: Torrent[];
  onNavigate?: (page: Page) => void;
}

export function NotificationDropdown({ downloads, torrents, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeDownloads = downloads
    .filter((d) => d.status === "downloading" || d.status === "pending")
    .slice(0, 3);

  const activeTorrents = torrents
    .filter((t) => ["queued", "resolving", "downloading"].includes(t.status))
    .slice(0, 3);

  const recent = downloads
    .filter((d) => d.status === "completed" || d.status === "failed")
    .slice(0, 3);

  const count = activeDownloads.length + activeTorrents.length;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="relative"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-sm bg-ink text-canvas text-[10px] font-medium flex items-center justify-center leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="fixed sm:absolute right-4 sm:right-0 top-16 sm:top-full sm:mt-2 left-4 sm:left-auto bg-canvas border border-hairline rounded-sm z-50 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)] sm:shadow-none"
          >
            <div className="py-2 max-h-[60vh] sm:max-h-[420px] overflow-y-auto">
              {count === 0 && recent.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-mute">
                  No activity yet
                </div>
              )}

              {activeDownloads.length > 0 && (
                <div className="px-3 pb-1">
                  <p className="text-[10px] font-semibold text-mute uppercase tracking-wider px-1 mb-1">
                    Downloads
                  </p>
                  {activeDownloads.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 px-3 py-2.5 sm:px-2 sm:py-1.5 rounded-sm hover:bg-surface-soft transition-colors cursor-pointer"
                      onClick={() => { setOpen(false); onNavigate?.("downloads"); }}
                    >
                      <Download className="size-4 sm:size-3 shrink-0 text-ink" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-xs truncate text-ink">{d.filename || d.url}</p>
                        <div className="flex items-center gap-2 mt-1 sm:mt-0.5">
                          <div className="flex-1 h-1.5 sm:h-1 bg-surface-card rounded-full overflow-hidden">
                            <div
                              className="h-full bg-ink rounded-full transition-all duration-300"
                              style={{ width: `${Math.round(d.progress * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs sm:text-[10px] text-mute tabular-nums shrink-0">
                            {Math.round(d.progress * 100)}%
                          </span>
                        </div>
                      </div>
                      {d.status === "downloading" && (
                        <Loader2 className="size-4 sm:size-3 shrink-0 text-mute animate-spin" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTorrents.length > 0 && (
                <div className="px-3 pb-1 pt-2">
                  <p className="text-[10px] font-semibold text-mute uppercase tracking-wider px-1 mb-1">
                    Torrents
                  </p>
                  {activeTorrents.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-3 py-2.5 sm:px-2 sm:py-1.5 rounded-sm hover:bg-surface-soft transition-colors cursor-pointer"
                      onClick={() => { setOpen(false); onNavigate?.("torrents"); }}
                    >
                      <Magnet className="size-4 sm:size-3 shrink-0 text-ink" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-xs truncate text-ink">{t.name || "Unknown Torrent"}</p>
                        <div className="flex items-center gap-2 mt-1 sm:mt-0.5">
                          <div className="flex-1 h-1.5 sm:h-1 bg-surface-card rounded-full overflow-hidden">
                            <div
                              className="h-full bg-ink rounded-full transition-all duration-300"
                              style={{ width: `${Math.round(t.progress * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs sm:text-[10px] text-mute tabular-nums shrink-0">
                            {Math.round(t.progress * 100)}%
                          </span>
                        </div>
                      </div>
                      {t.speed && (
                        <span className="text-xs sm:text-[10px] text-mute tabular-nums shrink-0">
                          {t.speed}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {recent.length > 0 && (
                <div className="px-3 pb-1 pt-2">
                  <p className="text-[10px] font-semibold text-mute uppercase tracking-wider px-1 mb-1">
                    Recent
                  </p>
                  {recent.map((d) => (
                    <div
                      key={`recent-${d.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 sm:px-2 sm:py-1.5 rounded-sm hover:bg-surface-soft transition-colors cursor-pointer"
                      onClick={() => { setOpen(false); onNavigate?.("downloads"); }}
                    >
                      {d.status === "completed" ? (
                        <CheckCircle className="size-4 sm:size-3 shrink-0 text-success" />
                      ) : (
                        <XCircle className="size-4 sm:size-3 shrink-0 text-destructive" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-xs truncate text-ink">
                          {d.filename || "Download"}
                        </p>
                        <p className="text-xs sm:text-[10px] text-mute">
                          {d.status === "completed" ? "Completed" : "Failed"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-hairline px-3 py-3 sm:py-2">
              <button
                onClick={() => { setOpen(false); onNavigate?.("downloads"); }}
                className="flex items-center justify-center gap-1 w-full text-sm sm:text-xs text-mute hover:text-ink transition-colors py-1.5 sm:py-1"
              >
                View all downloads
                <ArrowRight className="size-4 sm:size-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
