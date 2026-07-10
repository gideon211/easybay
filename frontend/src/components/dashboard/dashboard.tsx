import { useState, useEffect } from "react";
import {
  Download,
  Activity,
  HardDrive,
  Library,
} from "lucide-react";
import { StatsCard } from "./stats-card";
import { QuickAdd } from "./quick-add";
import { ActivityFeed } from "./activity-feed";
import { StorageWidget } from "./storage-widget";
import { TorrentMiniCard } from "./torrent-mini-card";
import { ActiveDownloadCard } from "./active-download-card";
import type { Download as DownloadType } from "@/lib/api";
import type { Torrent, SystemStats } from "@/lib/api";
import { getSystemStats } from "@/lib/api";

interface DashboardProps {
  downloads: DownloadType[];
  torrents: Torrent[];
  downloadsLoading: boolean;
  torrentsLoading: boolean;
  onAddDownload: (url: string, quality: string, removeWatermark?: boolean) => Promise<void>;
  onDeleteDownload: (id: number) => void;
  onPauseDownload?: (id: number) => void;
  onResumeDownload?: (id: number) => void;
  onRetryDownload?: (id: number) => void;
  onRedownload?: (id: number) => void;
  isSubmitting: boolean;
  onNavigate?: (page: string) => void;
}

export function Dashboard({
  downloads,
  torrents,
  downloadsLoading,
  torrentsLoading,
  onAddDownload,
  onDeleteDownload,
  onPauseDownload,
  onResumeDownload,
  onRetryDownload,
  onRedownload,
  isSubmitting,
  onNavigate,
}: DashboardProps) {
  const activeDownloads = downloads.filter(
    (d) => d.status === "downloading" || d.status === "pending" || d.status === "paused"
  );
  const completedToday = downloads.filter((d) => {
    if (d.status !== "completed" || !d.completed_at) return false;
    const today = new Date();
    const completed = new Date(d.completed_at);
    return (
      completed.getDate() === today.getDate() &&
      completed.getMonth() === today.getMonth() &&
      completed.getFullYear() === today.getFullYear()
    );
  }).length;
  const completedDownloads = downloads.filter((d) => d.status === "completed").length;
  const completedTorrents = torrents.filter((t) => t.status === "completed").length;

  const activeTorrents = torrents.filter(
    (t) => t.status === "downloading" || t.status === "resolving" || t.status === "queued"
  );

  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchStats = () => {
      getSystemStats()
        .then((s) => { if (mounted) setSystemStats(s); })
        .catch(() => {});
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-body mt-0.5">
          Here's what's happening right now.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          icon={Download}
          label="Total Downloads"
          value={downloads.length}
          trend={`+${completedToday} today`}
          trendColor="green"
        />
        <StatsCard
          icon={Activity}
          label="Active Transfers"
          value={activeDownloads.length + activeTorrents.length}
          trend={activeTorrents.length > 0 ? `${activeTorrents.length} queued` : undefined}
          trendColor="amber"
        />
        <StatsCard
          icon={HardDrive}
          label="Disk Usage"
          value={systemStats ? `${systemStats.disk_used_gb.toFixed(0)} GB` : "—"}
          trend={systemStats ? `${systemStats.disk_total_gb - systemStats.disk_used_gb} GB free` : undefined}
          trendColor="red"
        />
        <StatsCard
          icon={Library}
          label="Media Library"
          value={completedDownloads + completedTorrents}
          trend={`+${completedToday} this week`}
          trendColor="green"
        />
      </div>

      {/* Quick add URL */}
      <QuickAdd onSubmit={onAddDownload} isSubmitting={isSubmitting} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — 2/3 */}
        <div className="lg:col-span-2 space-y-5">
          {/* Active Downloads */}
          {activeDownloads.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  Active Downloads
                  <span className="inline-flex items-center justify-center size-5 rounded-sm bg-ink text-canvas text-[10px] font-bold">
                    {activeDownloads.length}
                  </span>
                </h2>
                <button
                  onClick={() => onNavigate?.("downloads")}
                  className="text-xs text-ink hover:underline"
                >
                  View all →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeDownloads.slice(0, 6).map((d) => (
                  <ActiveDownloadCard
                    key={d.id}
                    download={d}
                    onDelete={onDeleteDownload}
                    onPause={onPauseDownload}
                    onResume={onResumeDownload}
                    onRetry={onRetryDownload}
                    onRedownload={onRedownload}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recent Activity */}
          <div className="bg-card border border-hairline p-4">
            <h2 className="text-sm font-semibold mb-3">Recent Activity</h2>
            <ActivityFeed
              downloads={downloads}
              torrents={torrents}
              loading={downloadsLoading || torrentsLoading}
            />
          </div>
        </div>

        {/* Right sidebar — 1/3 */}
        <div className="space-y-4">
          <StorageWidget downloads={downloads} torrents={torrents} systemStats={systemStats} />

          {activeTorrents.length > 0 && (
            <div className="bg-card border border-hairline p-4 space-y-2">
              <h3 className="text-xs font-semibold text-mute uppercase tracking-wider">
                Active Torrents
              </h3>
              <div className="space-y-1">
                {activeTorrents.slice(0, 4).map((t) => (
                  <TorrentMiniCard key={t.id} torrent={t} />
                ))}
              </div>
              {activeTorrents.length > 4 && (
                <p className="text-[10px] text-mute text-center pt-1">
                  +{activeTorrents.length - 4} more
                </p>
              )}
            </div>
          )}

          <div className="bg-card border border-hairline p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-mute uppercase tracking-wider">
                System Status
              </h3>
              <span className="flex items-center gap-1.5 text-[11px] text-success">
                <span className="size-1.5 rounded-full bg-success" />
                All systems operational
              </span>
            </div>
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-mute">CPU</span>
                  <span className="tabular-nums">{systemStats?.cpu_percent ?? "—"}%</span>
                </div>
                <div className="h-1.5 bg-surface-card rounded-full overflow-hidden">
                  <div className="h-full bg-ink rounded-full transition-all duration-500" style={{ width: `${systemStats?.cpu_percent ?? 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-mute">RAM</span>
                  <span className="tabular-nums">{systemStats?.ram_percent ?? "—"}%</span>
                </div>
                <div className="h-1.5 bg-surface-card rounded-full overflow-hidden">
                  <div className="h-full bg-warning rounded-full transition-all duration-500" style={{ width: `${systemStats?.ram_percent ?? 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-mute">Disc</span>
                  <span className="tabular-nums">{systemStats?.disk_percent ?? "—"}%</span>
                </div>
                <div className="h-1.5 bg-surface-card rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full transition-all duration-500" style={{ width: `${systemStats?.disk_percent ?? 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
