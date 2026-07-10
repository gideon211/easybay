import { useState, useEffect, useCallback, useRef } from "react";
import {
  getTorrents,
  addTorrent,
  deleteTorrent,
  type Torrent,
  type TorrentAddRequest,
} from "@/lib/api";
import { notifyComplete, requestNotificationPermission } from "@/lib/notify";

export function useTorrents() {
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const notifiedIds = useRef(new Set<number>());

  requestNotificationPermission();

  const fetchTorrents = useCallback(async () => {
    try {
      const data = await getTorrents();
      setTorrents((prev) => {
        for (const t of data) {
          if (t.status === "completed" && !notifiedIds.current.has(t.id)) {
            const old = prev.find((p) => p.id === t.id);
            if (old && old.status !== "completed") {
              notifiedIds.current.add(t.id);
              notifyComplete("Torrent complete", t.name ?? undefined);
            }
          }
        }
        return data;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch torrents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTorrents();
    const interval = setInterval(fetchTorrents, 5000);
    return () => clearInterval(interval);
  }, [fetchTorrents]);

  const addNewTorrent = useCallback(
    async (data: TorrentAddRequest, file?: File) => {
      const torrent = await addTorrent(data, file);
      setTorrents((prev) => [torrent, ...prev]);
      return torrent;
    },
    []
  );

  const removeTorrent = useCallback(
    async (id: number) => {
      await deleteTorrent(id);
      setTorrents((prev) => prev.filter((t) => t.id !== id));
    },
    []
  );

  return {
    torrents,
    loading,
    error,
    addTorrent: addNewTorrent,
    removeTorrent,
    refresh: fetchTorrents,
  };
}
