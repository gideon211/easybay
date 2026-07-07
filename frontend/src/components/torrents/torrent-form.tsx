import { useState } from "react";
import { Magnet, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TorrentFormProps {
  onSubmit: (source: string) => Promise<void>;
  isSubmitting: boolean;
}

export function TorrentForm({ onSubmit, isSubmitting }: TorrentFormProps) {
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<"magnet" | "file">("magnet");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim()) return;
    await onSubmit(source.trim());
    setSource("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSource(file.name);
    }
  };

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("magnet")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                mode === "magnet"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Magnet className="size-3.5" />
              Magnet Link
            </button>
            <button
              type="button"
              onClick={() => setMode("file")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                mode === "file"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <FileUp className="size-3.5" />
              .torrent File
            </button>
          </div>

          {mode === "magnet" ? (
            <div className="space-y-1.5">
              <label htmlFor="magnet-input" className="text-sm font-medium text-foreground">
                Magnet URI
              </label>
              <Input
                id="magnet-input"
                type="text"
                placeholder="magnet:?xt=urn:btih:..."
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="flex-1 font-mono text-xs"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="torrent-file" className="text-sm font-medium text-foreground">
                Torrent File
              </label>
              <Input
                id="torrent-file"
                type="file"
                accept=".torrent"
                onChange={handleFileChange}
                className="flex-1"
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || !source.trim()}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Magnet className="size-4" />
                {mode === "magnet" ? "Add Magnet" : "Upload Torrent"}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
