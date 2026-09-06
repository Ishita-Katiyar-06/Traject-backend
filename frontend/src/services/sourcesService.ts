import { simulateFetch } from './apiClient';

export type SourceStatusType = 'Connected' | 'Connecting' | 'Degraded' | 'Offline';

export interface DataSourceItem {
  id: string;
  name: string;
  platform: 'X' | 'Telegram';
  status: SourceStatusType;
  lastUpdate: string;
  messageVelocity: string;
  latencyMs: number;
  dataAvailability: string;
  monitoredChannelsCount: number;
  healthNote: string;
}

export const MOCK_DATA_SOURCES: DataSourceItem[] = [
  {
    id: 'src-telegram',
    name: 'Telegram Real-Time Telemetry Collector',
    platform: 'Telegram',
    status: 'Connected',
    lastUpdate: '2 min ago',
    messageVelocity: '48.2 msgs/sec',
    latencyMs: 140,
    dataAvailability: '99.98% (24h)',
    monitoredChannelsCount: 384,
    healthNote: 'All 8 worker pool shards active; MTProto session pool nominal.',
  },
  {
    id: 'src-x',
    name: 'X (Twitter) Enterprise Stream Ingest',
    platform: 'X',
    status: 'Connected',
    lastUpdate: '1 min ago',
    messageVelocity: '124.6 msgs/sec',
    latencyMs: 95,
    dataAvailability: '99.94% (24h)',
    monitoredChannelsCount: 1250,
    healthNote: 'Filtered rule stream running within rate envelope. No packet drops.',
  },
];

export const sourcesService = {
  async getSources(): Promise<DataSourceItem[]> {
    return simulateFetch(MOCK_DATA_SOURCES);
  },

  async getSourceById(id: string): Promise<DataSourceItem | undefined> {
    const list = await this.getSources();
    return list.find((s) => s.id === id);
  },
};
