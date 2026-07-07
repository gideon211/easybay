import { Loader2, Magnet } from "lucide-react";
import { TorrentCard } from "./torrent-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Torrent } from "@/lib/api";

interface TorrentListProps {
  torrents: Torrent[];
  loading: boolean;
  onDelete: (id: number) => void;
}

export function TorrentList({ torrents, loading, onDelete }: TorrentListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 overflow-hidden p-4">
            <Skeleton className="h-4 w-3/4 mb-3" />
            <Skeleton className="h-3 w-1/2 mb-2" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (torrents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Magnet className="size-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">No torrents yet</p>
        <p className="text-sm text-muted-foreground/80 mt-1">
          Add a magnet link or upload a .torrent file to get started
        </p>
      </div>
    );
  }

  const active = torrents.filter(
    (t) => ["queued", "resolving", "downloading"].includes(t.status)
  );
  const completed = torrents.filter(
    (t) => ["completed", "error", "cancelled"].includes(t.status)
  );

  return (
    <div className="space-y-8">
      {active.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Loader2 className="size-4 text-primary animate-spin" />
            <h2 className="text-lg font-semibold">
              Active
              <span className="text-muted-foreground font-normal text-sm ml-2">
                {active.length}
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((torrent) => (
              <TorrentCard
                key={torrent.id}
                torrent={torrent}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">
            History
            <span className="text-muted-foreground font-normal text-sm ml-2">
              {completed.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map((torrent) => (
              <TorrentCard
                key={torrent.id}
                torrent={torrent}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
