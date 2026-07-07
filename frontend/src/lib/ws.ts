export interface ProgressMessage {
  progress: number;
  speed: string | null;
  eta: string | null;
  status: string;
  filename: string | null;
  error?: string;
}

type MessageHandler = (data: ProgressMessage) => void;

/**
 * Creates a WebSocket connection for real-time download progress.
 * Auto-reconnects on disconnect with exponential backoff.
 */
export function createProgressSocket(
  downloadId: number,
  onMessage: MessageHandler,
  onError?: (error: Event) => void
): () => void {
  const wsUrl = `ws://${window.location.host}/ws/${downloadId}`;
  let socket: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout>;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;

  function connect() {
    socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data) as ProgressMessage;
      if (data.status !== "ping") {
        onMessage(data);
      }
    };

    socket.onerror = (error) => {
      onError?.(error);
    };

    socket.onclose = () => {
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectTimeout = setTimeout(() => {
          reconnectAttempts++;
          connect();
        }, delay);
      }
    };

    socket.onopen = () => {
      reconnectAttempts = 0;
    };
  }

  connect();

  // Return cleanup function
  return () => {
    clearTimeout(reconnectTimeout);
    reconnectAttempts = maxReconnectAttempts;
    socket?.close();
  };
}
