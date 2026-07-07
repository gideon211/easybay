import { useState, useEffect, useCallback } from "react";
import {
  getDownloads,
  submitDownload,
  deleteDownload,
  pauseDownload,
  resumeDownload,
  type Download,
  type DownloadRequest,
} from "@/lib/api";
import { createProgressSocket, type ProgressMessage } from "@/lib/ws";

/**
 * Manages download state, WebSocket connections, and API interactions.
 */
export function useDownloads() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active WebSocket connections keyed by download ID
  const activeConnections = new Map<number, () => void>();

  const fetchDownloads = useCallback(async () => {
    try {
      const data = await getDownloads();
      setDownloads(data);
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

  const addDownload = useCallback(
    async (data: DownloadRequest) => {
      try {
        const download = await submitDownload(data);
        setDownloads((prev) => [download, ...prev]);

        // Connect to WebSocket for real-time progress
        connectToProgress(download.id);

        return download;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to submit download";
        setError(message);
        throw err;
      }
    },
    []
  );

  const connectToProgress = useCallback(
    (downloadId: number) => {
      // Don't connect if already connected
      if (activeConnections.has(downloadId)) return;

      const cleanup = createProgressSocket(
        downloadId,
        (data: ProgressMessage) => {
          setDownloads((prev) =>
            prev.map((d) =>
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
            )
          );

          // Clean up connection when download completes or fails
          if (data.status === "completed" || data.status === "failed") {
            const cleanupFn = activeConnections.get(downloadId);
            if (cleanupFn) {
              cleanupFn();
              activeConnections.delete(downloadId);
            }
          }
        }
      );

      activeConnections.set(downloadId, cleanup);
    },
    []
  );

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

  // Clean up all connections on unmount
  useEffect(() => {
    return () => {
      activeConnections.forEach((cleanup) => cleanup());
      activeConnections.clear();
    };
  }, []);

  return {
    downloads,
    loading,
    error,
    addDownload,
    removeDownload,
    pauseDownload: pause,
    resumeDownload: resume,
    refresh: fetchDownloads,
  };
}
