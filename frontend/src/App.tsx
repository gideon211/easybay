import { useState, useEffect, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Sidebar, type Page } from "@/components/layout/sidebar";
import { Dashboard } from "@/components/dashboard/dashboard";
import { DownloadList } from "@/components/downloads/download-list";
import { TorrentForm } from "@/components/torrents/torrent-form";
import { TorrentList } from "@/components/torrents/torrent-list";
import { ImageTools } from "@/components/image-tools/image-tools";
import { PassportPage } from "@/components/passport/passport-page";
import { SettingsPage } from "@/components/settings/settings-page";
import { FileBrowser } from "@/components/files/file-browser";
import { LandingPage } from "@/components/landing/landing-page";
import { useDownloads } from "@/hooks/use-downloads";
import { useTorrents } from "@/hooks/use-torrents";

const VALID_PAGES: Page[] = ["overview", "downloads", "torrents", "images", "passport", "files", "settings"];

function getPageFromURL(): Page {
  const params = new URLSearchParams(window.location.search);
  const p = params.get("page");
  if (p && VALID_PAGES.includes(p as Page)) return p as Page;
  return "overview";
}

export default function App() {
  const [showLanding, setShowLanding] = useState(() => !localStorage.getItem("easybay_landing_seen"));

  const handleContinue = useCallback(() => {
    localStorage.setItem("easybay_landing_seen", "true");
    setShowLanding(false);
  }, []);

  const [page, setPage] = useState<Page>(getPageFromURL);

  const handleNavigate = useCallback((newPage: Page) => {
    setPage(newPage);
    const url = new URL(window.location.href);
    url.searchParams.set("page", newPage);
    history.pushState(null, "", url.toString());
  }, []);

  useEffect(() => {
    const onPopState = () => setPage(getPageFromURL());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
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

  const handleTorrentSubmit = async (source: string, file?: File) => {
    setIsTorrentSubmitting(true);
    try {
      await addTorrent({ source }, file);
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

  if (showLanding) return <LandingPage onContinue={handleContinue} />;

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar active={page} onNavigate={handleNavigate} />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header downloads={downloads} torrents={torrents} onNavigate={handleNavigate} />

        <main className="flex-1 p-4 pb-16 md:p-6 md:pb-6">
            {page === "overview" && (
              <Dashboard
                downloads={downloads}
                torrents={torrents}
                downloadsLoading={downloadsLoading}
                torrentsLoading={torrentsLoading}
                onAddDownload={handleSubmit}
                onDeleteDownload={removeDownload}
                onPauseDownload={pauseDownload}
                onResumeDownload={resumeDownload}
                isSubmitting={isSubmitting}
                onNavigate={(p) => handleNavigate(p as Page)}
              />
            )}

            {page === "downloads" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-xl font-semibold">Downloads</h1>
                  <p className="text-sm text-body mt-0.5">
                    Download videos from social media platforms
                  </p>
                </div>
                {downloadsError && (
                  <div className="p-4 bg-destructive/10 text-destructive rounded-sm text-sm">
                    {downloadsError}
                  </div>
                )}
                <DownloadList
                  downloads={downloads}
                  loading={downloadsLoading}
                  onDelete={removeDownload}
                  onPause={pauseDownload}
                  onResume={resumeDownload}
                />
              </div>
            )}

            {page === "torrents" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-xl font-semibold">Torrents</h1>
                  <p className="text-sm text-body mt-0.5">
                    Add magnet links or torrent files to start downloading
                  </p>
                </div>
                <TorrentForm
                  onSubmit={handleTorrentSubmit}
                  isSubmitting={isTorrentSubmitting}
                />
                {torrentsError && (
                  <div className="p-4 bg-destructive/10 text-destructive rounded-sm text-sm">
                    {torrentsError}
                  </div>
                )}
                <TorrentList
                  torrents={torrents}
                  loading={torrentsLoading}
                  onDelete={removeTorrent}
                />
              </div>
            )}

            {page === "images" && <ImageTools />}

            {page === "passport" && <PassportPage />}

            {page === "files" && <FileBrowser />}

            {page === "settings" && <SettingsPage />}
          </main>
        </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "hsl(var(--canvas))",
            border: "1px solid hsl(var(--hairline))",
            color: "hsl(var(--ink))",
            borderRadius: "4px",
            fontFamily: "inherit",
            fontSize: "14px",
            boxShadow: "none",
          },
        }}
      />
    </div>
  );
}
