import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indeterminate?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indeterminate = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          "bg-surface-card relative h-2 w-full overflow-hidden rounded-full",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "bg-ink h-full rounded-full",
            indeterminate
              ? "w-1/3 animate-[download-progress_1.2s_ease-in-out_infinite]"
              : "transition-all duration-300 ease-out"
          )}
          style={indeterminate ? undefined : { width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
