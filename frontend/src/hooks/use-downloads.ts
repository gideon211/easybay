import { useState, useEffect, useCallback, useRef } from "react";
import {
  getDownloads,
  submitDownload,
  deleteDownload,
  pauseDownload,
  resumeDownload,
  retryDownload,
  clearFailedDownloads,
  reDownload,
  type Download,
  type DownloadRequest,
} from "@/lib/api";
import { createProgressSocket, type ProgressMessage } from "@/lib/ws";
import { notifyComplete, requestNotificationPermission } from "@/lib/notify";

/**
 * Manages download state, WebSocket connections, and API interactions.
 */
export function useDownloads() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const notifiedIds = useRef(new Set<number>());

  // Keep connection ownership stable across renders. A plain Map created in the hook body can be
  // replaced whenever React renders, leaving later effects unable to find and close older sockets.
  const activeConnections = useRef(new Map<number, () => void>());

  requestNotificationPermission();

  const fetchDownloads = useCallback(async () => {
    try {
      const data = await getDownloads();
      setDownloads((prev) => {
        for (const d of data) {
          if (d.status === "completed" && !notifiedIds.current.has(d.id)) {
            const old = prev.find((p) => p.id === d.id);
            if (old && old.status !== "completed") {
              notifiedIds.current.add(d.id);
              notifyComplete("Download complete", d.filename ?? undefined);
            }
          }
        }
        return data;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch downloads");
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for updates every 5 seconds
  useEffect(() => {
    fetchDownloads();
    const interval = setInterval(fetchDownloads, 5000);
    return () => clearInterval(interval);
  }, [fetchDownloads]);

  const connectToProgress = useCallback(
    (downloadId: number) => {
      // Don't connect if already connected
      if (activeConnections.current.has(downloadId)) return;

      const cleanup = createProgressSocket(
        downloadId,
        (data: ProgressMessage) => {
          setDownloads((prev) => {
            const old = prev.find((d) => d.id === downloadId);
            const wasCompleted = old?.status === "completed";
            const next = prev.map((d) =>
              d.id === downloadId
                ? {
                    ...d,
                    progress: data.progress,
                    speed: data.speed,
                    eta: data.eta,
                    status: data.status as Download["status"],
                    filename: data.filename ?? d.filename,
                  }
                : d
            );
            if (data.status === "completed" && !wasCompleted) {
              if (!notifiedIds.current.has(downloadId)) {
                notifiedIds.current.add(downloadId);
                notifyComplete("Download complete", data.filename ?? undefined);
              }
              // Completion should make the media available in the web player, not immediately
              // trigger the destructive save endpoint. The old automatic click downloaded and
              // then deleted the server copy before users could press Play in the Downloads page.
            }
            return next;
          });

          // Clean up connection when download completes or fails
          if (data.status === "completed" || data.status === "failed") {
            const cleanupFn = activeConnections.current.get(downloadId);
            if (cleanupFn) {
              cleanupFn();
              activeConnections.current.delete(downloadId);
            }
          }
        }
      );

      activeConnections.current.set(downloadId, cleanup);
    },
    []
  );

  const addDownload = useCallback(
    async (data: DownloadRequest) => {
      try {
        const download = await submitDownload(data);
        setDownloads((prev) => [download, ...prev]);

        // Connect immediately instead of waiting for the active-download effect below. This
        // minimizes the window in which a very short social-media transfer could finish first.
        connectToProgress(download.id);

        return download;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to submit download";
        setError(message);
        throw err;
      }
    },
    [connectToProgress]
  );

  useEffect(() => {
    // A page refresh or navigation can happen while a backend job is already running. Reattach
    // sockets for those records so progress remains live instead of falling back to 5-second
    // polling jumps. The connection map prevents duplicate sockets on subsequent renders.
    downloads
      .filter((download) => download.status === "pending" || download.status === "downloading")
      .forEach((download) => connectToProgress(download.id));
  }, [downloads, connectToProgress]);

  const removeDownload = useCallback(
    async (id: number) => {
      try {
        await deleteDownload(id);
        setDownloads((prev) => prev.filter((d) => d.id !== id));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete download";
        setError(message);
      }
    },
    []
  );

  const pause = useCallback(
    async (id: number) => {
      try {
        await pauseDownload(id);
        setDownloads((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status: "paused" as const } : d))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to pause download");
      }
    },
    []
  );

  const resume = useCallback(
    async (id: number) => {
      try {
        await resumeDownload(id);
        setDownloads((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status: "downloading" as const } : d))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to resume download");
      }
    },
    []
  );

  const retry = useCallback(
    async (id: number) => {
      try {
        const download = await retryDownload(id);
        setDownloads((prev) => prev.map((d) => (d.id === id ? download : d)));
        connectToProgress(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to retry download");
      }
    },
    [connectToProgress]
  );

  const clearFailed = useCallback(async () => {
    try {
      await clearFailedDownloads();
      setDownloads((prev) => prev.filter((d) => d.status !== "failed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear failed downloads");
    }
  }, []);

  // Clean up all connections on unmount
  useEffect(() => {
    const connections = activeConnections.current;
    return () => {
      connections.forEach((cleanup) => cleanup());
      connections.clear();
    };
  }, []);

  const downloadAgain = useCallback(
    async (id: number) => {
      try {
        const download = await reDownload(id);
        setDownloads((prev) => [download, ...prev]);
        connectToProgress(download.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to re-download");
      }
    },
    [connectToProgress]
  );

  return {
    downloads,
    loading,
    error,
    addDownload,
    removeDownload,
    pauseDownload: pause,
    resumeDownload: resume,
    retryDownload: retry,
    downloadAgain,
    clearFailedDownloads: clearFailed,
    refresh: fetchDownloads,
  };
}
