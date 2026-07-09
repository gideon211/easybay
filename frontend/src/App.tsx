import { useState } from "react";
import { Toaster, toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DownloadForm } from "@/components/downloads/download-form";
import { DownloadList } from "@/components/downloads/download-list";
import { TorrentForm } from "@/components/torrents/torrent-form";
import { TorrentList } from "@/components/torrents/torrent-list";
import { useDownloads } from "@/hooks/use-downloads";
import { useTorrents } from "@/hooks/use-torrents";
import { cn } from "@/lib/utils";

type Tab = "downloads" | "torrents";

export default function App() {
  const [tab, setTab] = useState<Tab>("downloads");
  const {
    downloads,
    loading: downloadsLoading,
    error: downloadsError,
    addDownload,
    removeDownload,
    pauseDownload,
    resumeDownload,
  } = useDownloads();
  const {
    torrents,
    loading: torrentsLoading,
    error: torrentsError,
    addTorrent,
    removeTorrent,
  } = useTorrents();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTorrentSubmitting, setIsTorrentSubmitting] = useState(false);

  const handleSubmit = async (
    url: string,
    quality: string,
    removeWatermark?: boolean
  ) => {
    setIsSubmitting(true);
    try {
      await addDownload({
        url,
        quality,
        remove_watermark: removeWatermark,
      });
      toast.success("Download submitted", {
        description: "Your download is starting...",
      });
    } catch (err) {
      toast.error("Failed to submit download", {
        description:
          err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTorrentSubmit = async (source: string) => {
    setIsTorrentSubmitting(true);
    try {
      await addTorrent({ source });
      toast.success("Torrent added", {
        description: "Torrent download is starting...",
      });
    } catch (err) {
      toast.error("Failed to add torrent", {
        description:
          err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsTorrentSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-12 space-y-10">
        <div className="max-w-2xl mx-auto space-y-3 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-none">
            EasyBay
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            YouTube · TikTok · Instagram · Twitter · Torrents — social media downloads, torrent support, and watermark removal, all in one place.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex justify-center">
          <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
            <button
              onClick={() => setTab("downloads")}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                tab === "downloads"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Social Downloads
            </button>
            <button
              onClick={() => setTab("torrents")}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                tab === "torrents"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Torrents
            </button>
          </div>
        </div>

        {tab === "downloads" && (
          <>
            <div className="max-w-2xl mx-auto">
              <DownloadForm
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
              />
            </div>

            {downloadsError && (
              <div className="max-w-2xl mx-auto p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                {downloadsError}
              </div>
            )}

            <div className="max-w-2xl mx-auto">
              <DownloadList
                downloads={downloads}
                loading={downloadsLoading}
                onDelete={removeDownload}
                onPause={pauseDownload}
                onResume={resumeDownload}
              />
            </div>
          </>
        )}

        {tab === "torrents" && (
          <>
            <div className="max-w-2xl mx-auto">
              <TorrentForm
                onSubmit={handleTorrentSubmit}
                isSubmitting={isTorrentSubmitting}
              />
            </div>

            {torrentsError && (
              <div className="max-w-2xl mx-auto p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                {torrentsError}
              </div>
            )}

            <div className="max-w-2xl mx-auto">
              <TorrentList
                torrents={torrents}
                loading={torrentsLoading}
                onDelete={removeTorrent}
              />
            </div>
          </>
        )}
      </main>

      <Footer />
      <Toaster position="top-center" />
    </div>
  );
}
