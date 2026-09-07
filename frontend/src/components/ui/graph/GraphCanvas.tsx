import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
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

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
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

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

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
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView={fitViewOnInit}
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={1.8}
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

        <Controls
          showInteractive={false}
          position="bottom-left"
          className="!bg-white dark:!bg-[#1C232B] !border !border-slate-200 dark:!border-[#2E3844] !rounded-xl !shadow-sm !overflow-hidden !m-4"
        />

        <MiniMap
          nodeStrokeWidth={2}
          zoomable
          pannable
          position="bottom-right"
          className="!bg-white/90 dark:!bg-[#1C232B]/90 !border !border-slate-200 dark:!border-[#2E3844] !rounded-xl !shadow-sm !overflow-hidden !m-4 hidden sm:block"
          nodeColor={(n) => {
            if (n.type === 'narrative') return '#FF6D5A';
            if (n.type === 'topic') return '#2F65F6';
            if (n.type === 'channel') return '#10B981';
            return '#94A3B8';
          }}
          maskColor={isDark ? 'rgba(18, 22, 27, 0.7)' : 'rgba(240, 244, 250, 0.7)'}
        />
      </ReactFlow>
    </div>
  );
};
