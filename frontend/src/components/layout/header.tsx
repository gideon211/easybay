import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationDropdown } from "@/components/layout/notification-dropdown";
import type { Download, Torrent } from "@/lib/api";
import type { Page } from "./sidebar";

interface HeaderProps {
  downloads?: Download[];
  torrents?: Torrent[];
  onNavigate?: (page: Page) => void;
}

export function Header({ downloads = [], torrents = [], onNavigate }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-canvas border-b border-hairline">
      <div className="flex items-center justify-between h-14 px-4 md:px-6">
        {/* Left spacer for mobile (logo is in sidebar on desktop) */}
        <div className="w-8 md:hidden" />

        {/* Search bar */}
        <div className="flex-1 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-mute" />
            <input
              type="text"
              placeholder="Search files, URLs, jobs..."
              className="w-full h-9 pl-9 pr-4 rounded-sm bg-surface-soft border border-hairline text-sm placeholder:text-mute/60 focus:outline-none focus:border-ink focus:bg-canvas transition-colors"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-mute bg-surface-card border border-hairline rounded-sm px-1.5 py-0.5">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <NotificationDropdown downloads={downloads} torrents={torrents} onNavigate={onNavigate} />
          <ThemeToggle />
          <div className="size-8 rounded-sm bg-surface-soft flex items-center justify-center text-xs font-semibold text-ink">
            GK
          </div>
        </div>
      </div>
    </header>
  );
}
