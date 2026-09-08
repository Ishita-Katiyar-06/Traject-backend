import React, { useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize2, Map } from 'lucide-react';
import { nodeTypes } from './CustomNodes';
import { useTheme } from '../../../contexts/ThemeContext';

export interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange?: OnNodesChange;
  onEdgesChange?: OnEdgesChange;
  onNodeClick?: NodeMouseHandler;
  onEdgeClick?: EdgeMouseHandler;
  onPaneClick?: () => void;
  className?: string;
  fitViewOnInit?: boolean;
}

const GraphCanvasInner: React.FC<GraphCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  className = '',
  fitViewOnInit = true,
}) => {
  const { isDark } = useTheme();
  const { fitView, setCenter, getZoom } = useReactFlow();
  const [showMiniMap, setShowMiniMap] = useState(false);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  // Smoothly center and fit view whenever nodes list updates (e.g. switching cascades)
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.28, duration: 450 });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  const handleInternalNodeClick: NodeMouseHandler = (event, node) => {
    if (onNodeClick) {
      onNodeClick(event, node);
    }
    // Smoothly pan camera so the clicked container is comfortably framed on the visible side
    if (node.position) {
      const currentZoom = Math.max(getZoom(), 0.85);
      setCenter(node.position.x + 140, node.position.y + 20, { zoom: currentZoom, duration: 400 });
    }
  };

  return (
    <div
      className={`relative w-full h-full min-h-[480px] rounded-[24px] overflow-hidden bg-[#FAFBFD] dark:bg-[#12161B] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-xs ${className}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleInternalNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView={fitViewOnInit}
        fitViewOptions={{ padding: 0.28 }}
        minZoom={0.15}
        maxZoom={2.0}
        proOptions={proOptions}
        elevateNodesOnSelect={true}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: isDark ? '#4B5563' : '#94A3B8',
            strokeWidth: 1.5,
          },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color={isDark ? '#2D3748' : '#D5DDE8'}
        />

        {/* Top-Left: Visual 4-Stage Pipeline Column Labels */}
        <Panel position="top-left" className="!m-3.5 max-w-[calc(100%-180px)] select-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#1C232B]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2E3844] shadow-xs text-[11px] font-mono overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>1. Origin</span>
            </div>
            <span className="text-slate-300 dark:text-slate-600 font-sans">➔</span>
            <div className="flex items-center gap-1.5 text-[#2F65F6] dark:text-[#5878C7] font-semibold whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-[#2F65F6]" />
              <span>2. Topic</span>
            </div>
            <span className="text-slate-300 dark:text-slate-600 font-sans">➔</span>
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>3. Narrative</span>
            </div>
            <span className="text-slate-300 dark:text-slate-600 font-sans">➔</span>
            <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>4. Amplification</span>
            </div>
          </div>
        </Panel>

        {/* Top-Right: Fit / Reset View Quick Action & MiniMap Toggle */}
        <Panel position="top-right" className="!m-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMiniMap((v) => !v)}
            title={showMiniMap ? 'Hide overview map' : 'Show overview map'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md border text-[11px] font-semibold shadow-xs transition-all cursor-pointer ${
              showMiniMap
                ? 'bg-[#2F65F6]/10 border-[#2F65F6] text-[#2F65F6]'
                : 'bg-white/95 dark:bg-[#1C232B]/95 border-slate-200/80 dark:border-[#2E3844] text-[#64748B] dark:text-slate-300 hover:text-[#111727] dark:hover:text-white'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Map</span>
          </button>

          <button
            type="button"
            onClick={() => fitView({ padding: 0.28, duration: 400 })}
            title="Reset zoom & center cascade"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#1C232B]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#2E3844] text-[12px] font-semibold text-[#111727] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#252E38] shadow-xs transition-all cursor-pointer hover:border-[#2F65F6]/40"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#2F65F6]" />
            <span>Center View</span>
          </button>
        </Panel>

        <Controls
          showInteractive={false}
          position="bottom-left"
          className="!bg-white dark:!bg-[#1C232B] !border !border-slate-200 dark:!border-[#2E3844] !rounded-xl !shadow-sm !overflow-hidden !m-4"
        />

        {showMiniMap && (
          <MiniMap
            nodeStrokeWidth={2}
            zoomable
            pannable
            position="bottom-right"
            className="!bg-white/95 dark:!bg-[#1C232B]/95 !border !border-slate-200 dark:!border-[#2E3844] !rounded-2xl !shadow-lg !overflow-hidden !m-4 z-10"
            nodeColor={(n) => {
              if (n.type === 'narrative') return '#FF6D5A';
              if (n.type === 'topic') return '#2F65F6';
              if (n.type === 'channel') return '#10B981';
              return '#94A3B8';
            }}
            maskColor={isDark ? 'rgba(18, 22, 27, 0.7)' : 'rgba(240, 244, 250, 0.7)'}
          />
        )}
      </ReactFlow>
    </div>
  );
};

export const GraphCanvas: React.FC<GraphCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
};

