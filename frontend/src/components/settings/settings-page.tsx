import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Download,
  Magnet,
  HardDrive,
  Palette,
  Info,
  Check,
  XCircle,
  Loader2,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/hooks/use-settings";
import { getSystemStats, type SystemStats } from "@/lib/api";

type Theme = "light" | "dark";

function getStoredTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme: Theme) {
  localStorage.setItem("theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface SectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}

function Section({ icon: Icon, title, children }: SectionProps) {
  return (
    <div className="bg-card border border-hairline rounded-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-ink" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <label className="text-sm text-ink">{label}</label>
        {description && <p className="text-[11px] text-mute mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const sliderClass =
  "w-28 h-1.5 rounded-full appearance-none bg-surface-card cursor-pointer " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink " +
  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-canvas " +
  "[&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:bg-ink [&::-moz-range-thumb]:border-2 " +
  "[&::-moz-range-thumb]:border-canvas [&::-moz-range-thumb]:cursor-pointer";

export function SettingsPage() {
  const { settings, loading, saving, error, update, reload } = useSettings();
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [localTheme, setLocalTheme] = useState<Theme>(getStoredTheme);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    getSystemStats()
      .then(setSysStats)
      .catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    const next = localTheme === "light" ? "dark" : "light";
    setLocalTheme(next);
    setTheme(next);
  }, [localTheme]);

  const handleSave = useCallback(
    async (key: string, value: string) => {
      const ok = await update(key, value);
      if (ok) {
        setSavedKeys((prev) => new Set(prev).add(key));
        setTimeout(() => {
          setSavedKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, 2000);
      }
    },
    [update],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-body mt-0.5">Configure your EasyBay instance</p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-sm bg-surface-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-body mt-0.5">Configure your EasyBay instance</p>
        </div>
        <div className="bg-destructive/5 rounded-sm p-4 text-sm text-destructive flex items-start gap-2">
          <XCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-body mt-0.5">Configure your EasyBay instance</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-destructive/5 rounded-sm p-3 text-sm text-destructive flex items-start gap-2"
          >
            <XCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Downloads */}
      <Section icon={Download} title="Downloads">
        <SettingRow label="Download directory" description="Where downloaded files are stored">
          <div className="flex items-center gap-2">
            <Input
              defaultValue={settings?.download_dir ?? ""}
              onBlur={(e) => handleSave("download_dir", e.target.value)}
              className="w-64 text-xs h-8"
            />
            <SaveIndicator show={savedKeys.has("download_dir")} saving={saving} />
          </div>
        </SettingRow>
        <SettingRow label="Max concurrent downloads">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={20}
              defaultValue={settings?.max_concurrent_downloads ?? "5"}
              onChange={(e) => handleSave("max_concurrent_downloads", e.target.value)}
              className={sliderClass}
            />
            <span className="text-xs tabular-nums text-mute w-6 text-right">
              {settings?.max_concurrent_downloads ?? "5"}
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Max YouTube concurrent">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={20}
              defaultValue={settings?.max_youtube_concurrent ?? "5"}
              onChange={(e) => handleSave("max_youtube_concurrent", e.target.value)}
              className={sliderClass}
            />
            <span className="text-xs tabular-nums text-mute w-6 text-right">
              {settings?.max_youtube_concurrent ?? "5"}
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Max retries">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={5}
              defaultValue={settings?.max_retries ?? "1"}
              onChange={(e) => handleSave("max_retries", e.target.value)}
              className={sliderClass}
            />
            <span className="text-xs tabular-nums text-mute w-4 text-right">
              {settings?.max_retries ?? "1"}
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Retry delay (seconds)">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={30}
              step={0.5}
              defaultValue={settings?.retry_delay ?? "2"}
              onChange={(e) => handleSave("retry_delay", e.target.value)}
              className={sliderClass}
            />
            <span className="text-xs tabular-nums text-mute w-8 text-right">
              {settings?.retry_delay ?? "2"}s
            </span>
          </div>
        </SettingRow>
      </Section>

      {/* Torrents */}
      <Section icon={Magnet} title="Torrents">
        <SettingRow label="Torrent directory">
          <div className="flex items-center gap-2">
            <Input
              defaultValue={settings?.torrent_dir ?? ""}
              onBlur={(e) => handleSave("torrent_dir", e.target.value)}
              className="w-64 text-xs h-8"
            />
            <SaveIndicator show={savedKeys.has("torrent_dir")} saving={saving} />
          </div>
        </SettingRow>
        <SettingRow label="Port range start">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1024}
              max={65535}
              defaultValue={settings?.torrent_port_start ?? "6881"}
              onBlur={(e) => handleSave("torrent_port_start", e.target.value)}
              className="w-20 h-8 rounded-sm border border-hairline bg-surface-soft px-2 text-xs tabular-nums text-ink outline-none focus:border-ink"
            />
          </div>
        </SettingRow>
        <SettingRow label="Port range end">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1024}
              max={65535}
              defaultValue={settings?.torrent_port_end ?? "6889"}
              onBlur={(e) => handleSave("torrent_port_end", e.target.value)}
              className="w-20 h-8 rounded-sm border border-hairline bg-surface-soft px-2 text-xs tabular-nums text-ink outline-none focus:border-ink"
            />
          </div>
        </SettingRow>
        <SettingRow label="DHT timeout (seconds)">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={60}
              defaultValue={settings?.torrent_dht_timeout ?? "15"}
              onChange={(e) => handleSave("torrent_dht_timeout", e.target.value)}
              className={sliderClass}
            />
            <span className="text-xs tabular-nums text-mute w-8 text-right">
              {settings?.torrent_dht_timeout ?? "15"}s
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Metadata timeout (seconds)">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={60}
              defaultValue={settings?.torrent_metadata_timeout ?? "10"}
              onChange={(e) => handleSave("torrent_metadata_timeout", e.target.value)}
              className={sliderClass}
            />
            <span className="text-xs tabular-nums text-mute w-8 text-right">
              {settings?.torrent_metadata_timeout ?? "10"}s
            </span>
          </div>
        </SettingRow>
      </Section>

      {/* Storage */}
      <Section icon={HardDrive} title="Storage">
        <SettingRow label="Uploads directory">
          <div className="flex items-center gap-2">
            <Input
              defaultValue={settings?.uploads_dir ?? ""}
              onBlur={(e) => handleSave("uploads_dir", e.target.value)}
              className="w-64 text-xs h-8"
            />
            <SaveIndicator show={savedKeys.has("uploads_dir")} saving={saving} />
          </div>
        </SettingRow>
        <SettingRow label="BG results directory">
          <div className="flex items-center gap-2">
            <Input
              defaultValue={settings?.bg_results_dir ?? ""}
              onBlur={(e) => handleSave("bg_results_dir", e.target.value)}
              className="w-64 text-xs h-8"
            />
            <SaveIndicator show={savedKeys.has("bg_results_dir")} saving={saving} />
          </div>
        </SettingRow>
        <SettingRow label="Log file">
          <div className="flex items-center gap-2">
            <Input
              defaultValue={settings?.log_file ?? ""}
              onBlur={(e) => handleSave("log_file", e.target.value)}
              className="w-64 text-xs h-8"
            />
            <SaveIndicator show={savedKeys.has("log_file")} saving={saving} />
          </div>
        </SettingRow>
        {sysStats && (
          <SettingRow label="Disk usage">
            <div className="flex items-center gap-3 w-64">
              <div className="flex-1 h-1.5 bg-surface-card rounded-full overflow-hidden">
                <div
                  className="h-full bg-ink rounded-full transition-all duration-500"
                  style={{ width: `${sysStats.disk_percent}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-mute w-12 text-right">
                {sysStats.disk_percent}%
              </span>
            </div>
          </SettingRow>
        )}
      </Section>

      {/* Appearance */}
      <Section icon={Palette} title="Appearance">
        <SettingRow label="Theme">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="gap-2 w-28"
          >
            {localTheme === "light" ? (
              <>
                <Moon className="size-3.5" />
                Dark
              </>
            ) : (
              <>
                <Sun className="size-3.5" />
                Light
              </>
            )}
          </Button>
        </SettingRow>
      </Section>

      {/* About */}
      <Section icon={Info} title="About">
        <SettingRow label="Backend status">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="size-1.5 rounded-sm bg-success" />
            Connected
          </span>
        </SettingRow>
        <SettingRow label="Version">
          <span className="text-xs text-mute tabular-nums">0.1.0</span>
        </SettingRow>
        {sysStats && (
          <>
            <SettingRow label="CPU">
              <span className="text-xs text-mute tabular-nums">{sysStats.cpu_percent}%</span>
            </SettingRow>
            <SettingRow label="Memory">
              <span className="text-xs text-mute tabular-nums">
                {sysStats.ram_used_gb}GB / {sysStats.ram_total_gb}GB
              </span>
            </SettingRow>
            <SettingRow label="Disk">
              <span className="text-xs text-mute tabular-nums">
                {sysStats.disk_used_gb}GB / {sysStats.disk_total_gb}GB
              </span>
            </SettingRow>
          </>
        )}
      </Section>
    </div>
  );
}

function SaveIndicator({ show, saving }: { show: boolean; saving: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="text-xs text-success flex items-center gap-1"
        >
          {saving ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
