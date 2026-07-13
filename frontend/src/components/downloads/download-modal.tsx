import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, X } from "lucide-react";
import { DownloadForm } from "./download-form";

interface DownloadModalProps {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (url: string, quality: string, removeWatermark?: boolean) => Promise<boolean>;
}

export function DownloadModal({ open, isSubmitting, onClose, onSubmit }: DownloadModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };

    // Lock the page behind the modal so touchpad and mobile scrolling cannot move the
    // download list while the user is selecting a format in the foreground dialog.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmitting, onClose, open]);

  const handleSubmit = async (url: string, quality: string, removeWatermark?: boolean) => {
    const submitted = await onSubmit(url, quality, removeWatermark);
    // Keep the entered URL and selected format visible after an API error. Closing on failure
    // would force the user to reopen the dialog and reconstruct the request just to retry it.
    if (submitted) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-download-title"
        >
          <button
            type="button"
            aria-label="Close download dialog"
            className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
            onClick={() => !isSubmitting && onClose()}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl overflow-hidden rounded-sm border border-hairline bg-canvas"
          >
            <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
              <div className="flex size-8 items-center justify-center rounded-sm bg-surface-card">
                <Download className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="new-download-title" className="text-sm font-semibold">New download</h2>
                <p className="text-xs text-mute">Paste a media URL and choose the output quality</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="inline-flex size-8 items-center justify-center rounded-sm text-mute transition-colors hover:bg-surface-soft hover:text-ink disabled:opacity-40"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-4 [&>div]:border-0 [&>div]:bg-transparent [&>div>div]:p-0">
              <DownloadForm
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
