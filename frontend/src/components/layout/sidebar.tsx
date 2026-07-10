import { useState } from "react";
import {
  LayoutDashboard,
  Download,
  Magnet,
  Image,
  Settings,
  Menu,
  X,
  IdCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Page = "overview" | "downloads" | "torrents" | "images" | "passport" | "settings";

interface SidebarProps {
  active: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "torrents", label: "Torrents", icon: Magnet },
  { id: "images", label: "Image Tools", icon: Image },
  { id: "passport", label: "Passport Photos", icon: IdCard },
  { id: "settings", label: "Settings", icon: Settings },
];

function EasyBayLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="36" height="36" rx="4" fill="currentColor" />
      <path
        d="M10 10.5h10.5c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2H12.5v1.5h7c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2H10v-9.5z"
        fill="var(--canvas)"
        opacity="0.95"
      />
      <path
        d="M24 17v7.5c0 .8-.7 1.5-1.5 1.5h-1c-.8 0-1.5-.7-1.5-1.5V17l-2.5 2.5c-.6.6-1.5.6-2.1 0l-.7-.7c-.6-.6-.6-1.5 0-2.1l5.3-5.3c.3-.3.6-.4 1-.4s.7.1 1 .4l5.3 5.3c.6.6.6 1.5 0 2.1l-.7.7c-.6.6-1.5.6-2.1 0L24 17z"
        fill="var(--canvas)"
        opacity="0.95"
      />
    </svg>
  );
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed bottom-4 right-4 z-50 flex items-center justify-center size-12 rounded-sm bg-ink text-canvas md:hidden"
      >
        {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-hairline bg-canvas h-screen">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-hairline shrink-0">
          <EasyBayLogo className="size-8 shrink-0 text-ink" />
          <span className="font-bold text-base text-ink">
            EasyBay
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 pt-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium transition-colors text-left",
                  isActive
                    ? "bg-ink/[0.06] text-ink"
                    : "text-mute hover:text-ink hover:bg-surface-soft"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="border-t border-hairline p-3 mt-auto">
          <div className="flex items-center gap-3">
            <div className="shrink-0 flex items-center justify-center size-9 rounded-sm bg-surface-soft text-ink text-sm font-semibold">
              GK
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight truncate text-ink">Gideon Kwarteng</p>
              <p className="text-[11px] text-mute">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/40 md:hidden transition-opacity duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-60 bg-canvas border-r border-hairline md:hidden animate-in slide-in-from-left duration-200">
            {/* Mobile Logo */}
            <div className="flex items-center gap-3 px-4 h-14 border-b border-hairline">
              <EasyBayLogo className="size-8 shrink-0 text-ink" />
              <span className="font-bold text-base text-ink">
                EasyBay
              </span>
            </div>
            <nav className="flex flex-col gap-0.5 px-2 pt-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium transition-colors text-left",
                      isActive
                        ? "bg-ink/[0.06] text-ink"
                        : "text-mute hover:text-ink hover:bg-surface-soft"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-hairline p-3 mt-auto absolute bottom-0 left-0 right-0">
              <div className="flex items-center gap-3">
                <div className="shrink-0 flex items-center justify-center size-9 rounded-sm bg-surface-soft text-ink text-sm font-semibold">
                  GK
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">Gideon Kwarteng</p>
                  <p className="text-[11px] text-mute">Admin</p>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
