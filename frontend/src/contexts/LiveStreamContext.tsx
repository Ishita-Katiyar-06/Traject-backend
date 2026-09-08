import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  websocketService,
  type ConnectionStatus,
  type LiveMessageEvent,
  type ConnectionAckData,
} from '../services/websocketService';
import type { AlertItem } from '../types/alerts';
import { alertService } from '../services/alertService';

export interface LiveStreamContextType {
  connectionStatus: ConnectionStatus;
  latencyMs: number;
  liveMessages: LiveMessageEvent[];
  liveAlerts: AlertItem[];
  dismissLiveAlert: (alertId: string) => void;
  clearLiveAlerts: () => void;
  isPaused: boolean;
  togglePause: () => void;
  totalCorpusCount: number | null;
  channelsMonitored: number;
  channelsJoined: number;
}

const LiveStreamContext = createContext<LiveStreamContextType | undefined>(undefined);

export const LiveStreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(websocketService.getStatus());
  const [latencyMs, setLatencyMs] = useState<number>(websocketService.getLatency());
  const [liveMessages, setLiveMessages] = useState<LiveMessageEvent[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<AlertItem[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [totalCorpusCount, setTotalCorpusCount] = useState<number | null>(null);
  const [channelsMonitored, setChannelsMonitored] = useState<number>(0);
  const [channelsJoined, setChannelsJoined] = useState<number>(0);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const dismissLiveAlert = useCallback((alertId: string) => {
    setLiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const clearLiveAlerts = useCallback(() => {
    setLiveAlerts([]);
  }, []);

  useEffect(() => {
    // 1. Establish connection
    websocketService.connect();

    // 2. Status & Latency listeners
    const handleStatus = (status: ConnectionStatus) => {
      setConnectionStatus(status);
    };

    const handleLatency = (lat: number) => {
      setLatencyMs(lat);
    };

    // 3. Handshake listener
    const handleAck = (data: ConnectionAckData) => {
      if (data.active_corpus_records) {
        setTotalCorpusCount(data.active_corpus_records);
      }
      if (data.channels_monitored !== undefined) {
        setChannelsMonitored(data.channels_monitored);
      }
      if (data.channels_joined !== undefined) {
        setChannelsJoined(data.channels_joined);
      }
      // Populate initial buffer if empty
      if (data.recent_history && data.recent_history.length > 0) {
        const msgs = data.recent_history
          .filter((evt) => evt.type === 'message_ingested')
          .map((evt) => evt.data as LiveMessageEvent);
        if (msgs.length > 0) {
          setLiveMessages(msgs);
        }
      }
    };

    // 4. Live Message Ingestion listener
    const handleMessageIngested = (msg: LiveMessageEvent) => {
      if (msg.total_corpus_count) {
        setTotalCorpusCount(msg.total_corpus_count);
      }
      if (!isPaused) {
        setLiveMessages((prev) => [msg, ...prev.slice(0, 49)]);
      }
    };

    // 5. Live Alert Trigger listener
    const handleAlertTriggered = (alert: AlertItem) => {
      setLiveAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
      // Cache in alertService so AlertsPage and navigation badges update reactively
      try {
        alertService.addLiveAlert(alert);
        window.dispatchEvent(new CustomEvent('tessera:alerts-updated', { detail: alert }));
      } catch (e) {
        console.warn('Could not dispatch local alerts event:', e);
      }
    };

    websocketService.on('status', handleStatus);
    websocketService.on('latency', handleLatency);
    websocketService.on('connection_ack', handleAck);
    websocketService.on('message_ingested', handleMessageIngested);
    websocketService.on('alert_triggered', handleAlertTriggered);

    return () => {
      websocketService.off('status', handleStatus);
      websocketService.off('latency', handleLatency);
      websocketService.off('connection_ack', handleAck);
      websocketService.off('message_ingested', handleMessageIngested);
      websocketService.off('alert_triggered', handleAlertTriggered);
    };
  }, [isPaused]);

  return (
    <LiveStreamContext.Provider
      value={{
        connectionStatus,
        latencyMs,
        liveMessages,
        liveAlerts,
        dismissLiveAlert,
        clearLiveAlerts,
        isPaused,
        togglePause,
        totalCorpusCount,
        channelsMonitored,
        channelsJoined,
      }}
    >
      {children}
    </LiveStreamContext.Provider>
  );
};

export const useLiveStream = (): LiveStreamContextType => {
  const context = useContext(LiveStreamContext);
  if (!context) {
    throw new Error('useLiveStream must be used within a LiveStreamProvider');
  }
  return context;
};
