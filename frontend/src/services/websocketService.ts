/**
 * TESSERA WebSocket Client Service
 *
 * Establishes and maintains a duplex WebSocket connection to the backend
 * real-time stream endpoint (/api/v1/ws/live). Supports exponential backoff
 * reconnection, heartbeat latency tracking, and typed event subscriptions.
 */

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface LiveMessageEvent {
  message_id: string;
  native_id: string | number;
  channel_title: string;
  channel_username: string | null;
  text: string;
  text_preview: string;
  timestamp: string;
  views: number;
  forwards: number;
  has_media: boolean;
  total_corpus_count: number;
}

export interface ConnectionAckData {
  status: string;
  active_corpus_records: number;
  artifacts_loaded: boolean;
  dataset_source: string;
  channels_monitored?: number;
  channels_joined?: number;
  recent_history: Array<{ type: string; data: any; timestamp_utc: string }>;
  server_time_utc: string;
}

type EventCallback<T = any> = (data: T) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private status: ConnectionStatus = 'disconnected';
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private reconnectTimeoutId: any = null;
  private pingIntervalId: any = null;
  private lastPingSentAt = 0;
  private latencyMs = 0;

  constructor() {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    const port = '8000'; // FastAPI backend default port
    const protocol = isHttps ? 'wss:' : 'ws:';
    this.url = `${protocol}//${host}:${port}/api/v1/ws/live`;
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket stream error:', err);
      };
    } catch (e) {
      console.error('Failed to instantiate WebSocket client:', e);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getLatency(): number {
    return this.latencyMs;
  }

  public on<T = any>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off<T = any>(event: string, callback: EventCallback<T>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public send(type: string, data?: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
    }
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.emit('status', newStatus);
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in WebSocket event listener for ${event}:`, err);
        }
      });
    }
  }

  private handleMessage(raw: string): void {
    try {
      const payload = JSON.parse(raw);
      const { type, data } = payload;

      if (type === 'pong') {
        if (this.lastPingSentAt > 0) {
          this.latencyMs = Math.max(1, Date.now() - this.lastPingSentAt);
          this.emit('latency', this.latencyMs);
        }
        return;
      }

      this.emit(type, data);
    } catch (err) {
      console.warn('Could not parse incoming WebSocket frame:', raw, err);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalId = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingSentAt = Date.now();
        this.send('ping', { timestamp: this.lastPingSentAt });
      }
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) return;

    this.reconnectAttempts += 1;
    // Exponential backoff with jitter: min(1000 * 2^attempts, 30000)
    const delay = Math.min(1000 * Math.pow(1.8, this.reconnectAttempts), this.maxReconnectDelay);

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connect();
    }, delay);
  }
}

export const websocketService = new WebSocketService();
