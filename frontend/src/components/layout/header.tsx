import { Download } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="flex items-center justify-between max-w-screen-xl mx-auto px-4 h-14">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground">
            <Download className="size-4" />
          </div>
          <span className="font-semibold text-lg tracking-tight">EasyBay</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
