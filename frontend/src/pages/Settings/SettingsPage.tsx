import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SystemStatus } from '../../components/status/SystemStatus';
import { useApp, SystemStatusType } from '../../contexts/AppContext';
import { sourcesService, DataSourceItem } from '../../services/sourcesService';
import { RefreshCw, Server } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { systemStatus, setSystemStatus } = useApp();
  const [sources, setSources] = useState<DataSourceItem[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(true);

  const statuses: SystemStatusType[] = ['operational', 'connecting', 'degraded', 'offline'];

  const loadSources = async () => {
    setIsLoadingSources(true);
    try {
      const data = await sourcesService.getSources();
      setSources(data);
    } catch (e) {
      console.error('Failed to load sources:', e);
    } finally {
      setIsLoadingSources(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const getSourceStatusBadge = (status: DataSourceItem['status']) => {
    switch (status) {
      case 'Connected':
        return <Badge variant="confirmed" size="sm">Connected</Badge>;
      case 'Connecting':
        return <Badge variant="signal" size="sm">Connecting</Badge>;
      case 'Degraded':
        return <Badge variant="signal" size="sm">Degraded</Badge>;
      case 'Offline':
        return <Badge variant="critical" size="sm">Offline</Badge>;
    }
  };

  return (
    <div className="space-y-8 font-sans">
      <PageHeader
        title="Settings & Data Sources"
        description="Monitor upstream collector telemetry, manage source ingest pipelines, and configure environment preferences."
      />

      {/* 1. Monitored Data Sources Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-bold text-[#111727]">
              Monitored Telemetry Ingest Streams
            </h3>
            <p className="text-[#8591A5] text-[12px] font-mono mt-0.5">
              Live ingest health for social microblogging and channel collector pools
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingSources ? 'animate-spin' : ''}`} />}
            onClick={loadSources}
            disabled={isLoadingSources}
          >
            Refresh Sources
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((src) => (
            <div
              key={src.id}
              className="p-5 rounded-[22px] border border-[rgba(228,233,245,0.85)] bg-white shadow-xs space-y-3.5 font-sans"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#EFF4FE] flex items-center justify-center text-[#2F65F6]">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-bold text-[#111727]">
                      {src.name}
                    </h4>
                    <span className="text-[12px] text-[#8591A5]">
                      Platform: {src.platform} • {src.monitoredChannelsCount} channels
                    </span>
                  </div>
                </div>

                {getSourceStatusBadge(src.status)}
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-[14px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)]">
                  <span className="text-[#8591A5] text-[10px] font-bold uppercase tracking-wider block">VELOCITY</span>
                  <span className="text-[#111727] font-bold text-[13px] mt-0.5 block">{src.messageVelocity}</span>
                </div>

                <div className="p-2.5 rounded-[14px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)]">
                  <span className="text-[#8591A5] text-[10px] font-bold uppercase tracking-wider block">LATENCY</span>
                  <span className="text-[#2F65F6] font-bold text-[13px] mt-0.5 block">{src.latencyMs} ms</span>
                </div>

                <div className="p-2.5 rounded-[14px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)]">
                  <span className="text-[#8591A5] text-[10px] font-bold uppercase tracking-wider block">AVAILABILITY</span>
                  <span className="text-[#10B981] font-bold text-[13px] mt-0.5 block">{src.dataAvailability}</span>
                </div>
              </div>

              <div className="p-3 rounded-[14px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] text-[12px] text-[#475569] font-sans">
                <span className="text-[10px] font-bold text-[#8591A5] uppercase mr-1.5">COLLECTOR NOTE:</span>
                {src.healthNote}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Global Environment Readout & Override */}
      <section className="p-6 rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white shadow-xs space-y-4">
        <div>
          <h3 className="text-[17px] font-bold font-sans text-[#111727]">Global System Readout</h3>
          <p className="text-[#64748B] text-[13px] mt-0.5">
            Test and simulate the application shell's global telemetry status indicators:
          </p>
        </div>

        <div className="flex items-center gap-3 p-4 bg-[#F8FAFD] rounded-[18px] border border-[rgba(228,233,245,0.85)]">
          <span className="text-[#64748B] text-[13px] font-medium">Current Global Status Indicator:</span>
          <SystemStatus />
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {statuses.map((st) => (
            <Button
              key={st}
              variant={systemStatus === st ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSystemStatus(st)}
            >
              Simulate {st}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
};
