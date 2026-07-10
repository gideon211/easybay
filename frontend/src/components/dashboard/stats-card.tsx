import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: string;
  trendColor?: "green" | "amber" | "red" | "default";
}

export function StatsCard({ icon: Icon, label, value, trend, trendColor = "default" }: StatsCardProps) {
  const trendClasses = {
    green: "text-success",
    amber: "text-warning",
    red: "text-destructive",
    default: "text-mute",
  };

  return (
    <div className="bg-card border border-hairline p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-mute font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-ink">{value}</p>
        </div>
        <div className="flex items-center justify-center size-9 rounded-sm bg-ink/[0.06] text-ink">
          <Icon className="size-4" />
        </div>
      </div>
      {trend && (
        <p className={`text-xs mt-2 font-medium ${trendClasses[trendColor]}`}>{trend}</p>
      )}
    </div>
  );
}
