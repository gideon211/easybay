import { useState, useRef, useCallback, useEffect } from "react";

export interface BgProgressState {
  progress: number;
  phase: string;
  label: string;
  elapsed: number;
  status: "idle" | "processing" | "complete" | "error";
  error?: string;
}

const WS_BASE = `ws://${window.location.host}/ws/remove-bg`;
const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function useRemoveBg() {
  const [state, setState] = useState<BgProgressState>({
    progress: 0,
    phase: "idle",
    label: "",
    elapsed: 0,
    status: "idle",
  });
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    stopTimer();
    timerRef.current = setInterval(() => {
      setState((prev) =>
        prev.status === "processing"
          ? { ...prev, elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000) }
          : prev
      );
    }, 1000);
  }, [stopTimer]);

  const cleanup = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    stopTimer();
  }, [stopTimer]);

  const start = useCallback(
    async (file: File): Promise<void> => {
      cleanup();
      taskIdRef.current = null;

      setState({
        progress: 0,
        phase: "uploading",
        label: "Uploading...",
        elapsed: 0,
        status: "processing",
      });

      try {
        // Upload file
        const form = new FormData();
        form.append("file", file);
        form.append("output_format", "PNG");

        const uploadRes = await fetch(`${API_BASE}/remove-bg/start`, {
          method: "POST",
          body: form,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.detail || "Upload failed");
        }

        const { task_id } = await uploadRes.json();
        taskIdRef.current = task_id;

        // Connect WebSocket for progress
        const ws = new WebSocket(`${WS_BASE}/${task_id}`);
        wsRef.current = ws;

        startTimer();

        return new Promise<void>((resolve, reject) => {
          let settled = false;

          const settle = (fn: () => void) => {
            if (settled) return;
            settled = true;
            fn();
          };

          // Timeout after 5 minutes
          const timeout = setTimeout(() => {
            settle(() => {
              setState((prev) => ({ ...prev, status: "error", error: "Processing timed out after 5 minutes" }));
              ws.close();
              reject(new Error("Processing timed out after 5 minutes"));
            });
          }, 300_000);

          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "ping") return;

            if (data.type === "progress") {
              setState((prev) => ({
                ...prev,
                progress: data.progress,
                phase: data.phase,
                label: data.label,
                status: "processing",
              }));
            }

            if (data.type === "complete") {
              clearTimeout(timeout);
              settle(() => {
                setState((prev) => ({
                  ...prev,
                  progress: 100,
                  phase: "done",
                  label: "Complete",
                  status: "complete",
                  elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000),
                }));
                ws.close();
              });
              resolve();
            }

            if (data.type === "error") {
              clearTimeout(timeout);
              settle(() => {
                setState((prev) => ({
                  ...prev,
                  status: "error",
                  error: data.error || "Processing failed",
                }));
                ws.close();
              });
              reject(new Error(data.error || "Processing failed"));
            }
          };

          ws.onerror = () => {
            clearTimeout(timeout);
            settle(() => {
              reject(new Error("WebSocket connection failed"));
            });
          };

          ws.onclose = (event) => {
            clearTimeout(timeout);
            settle(() => {
              if (event.code !== 1000 && event.code !== 1005) {
                setState((prev) => ({
                  ...prev,
                  status: "error",
                  error: `Connection lost (code ${event.code})${event.reason ? ": " + event.reason : ""}`,
                }));
                reject(new Error(`Connection lost (code ${event.code})`));
              }
            });
          };
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start";
        setState((prev) => ({ ...prev, status: "error", error: message }));
        cleanup();
        throw err;
      }
    },
    [cleanup, startTimer]
  );

  const getResultUrl = useCallback((): string | null => {
    if (!taskIdRef.current) return null;
    return `${API_BASE}/remove-bg/result/${taskIdRef.current}`;
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setState({ progress: 0, phase: "idle", label: "", elapsed: 0, status: "idle" });
    taskIdRef.current = null;
  }, [cleanup]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { state, start, getResultUrl, reset };
}
