import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "online" | "offline" | "checking";

export function SystemStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let mounted = true;
    const check = () => {
      fetch("/api/health")
        .then((res) => {
          if (mounted) setStatus(res.ok ? "online" : "offline");
        })
        .catch(() => {
          if (mounted) setStatus("offline");
        });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "size-2 rounded-full transition-colors duration-500",
          status === "online" && "bg-success",
          status === "offline" && "bg-destructive",
          status === "checking" && "bg-mute/30 animate-pulse"
        )}
      />
      <span className="text-xs text-mute capitalize">
        {status === "online" ? "System Online" : status === "offline" ? "Offline" : "Checking..."}
      </span>
    </div>
  );
}
