import { 
  Download, 
  AudioWaveform, 
  Brain, 
  BarChart3, 
  Scissors,
  Check,
  Ban,
  Minus,
} from 'lucide-react';
import type { StageInfo, PipelineStage, GateResult } from './pipelineUtils.js';
import { getStatusStyle, computeStageGate, STAGE_DEPENDENCIES } from './pipelineUtils.js';
import './PipelineStepper.css';

// ─── Stage Icons ──────────────────────────────────────────────

const STAGE_ICONS: Record<PipelineStage, React.ReactNode> = {
  ingestion:  <Download size={20} />,
  transcode:  <AudioWaveform size={20} />,
  embeddings: <Brain size={20} />,
  peaks:      <BarChart3 size={20} />,
  segments:   <Scissors size={20} />,
};

// ─── Gate Icon ────────────────────────────────────────────────

function GateIcon({ gate }: { gate: GateResult }) {
  const cls = `pipeline-connector-gate ${gate.state}`;
  switch (gate.state) {
    case 'passed':
      return <span className={cls}><Check size={10} strokeWidth={3} /></span>;
    case 'halted':
      return <span className={cls}><Ban size={10} strokeWidth={3} /></span>;
    case 'pending':
      return <span className={cls}><Minus size={10} strokeWidth={2.5} /></span>;
  }
}

// ─── Single Connector ─────────────────────────────────────────

function Connector({ 
  fromStage, 
  stages,
}: { 
  fromStage: StageInfo; 
  stages: StageInfo[];
}) {
  const fromStyle = getStatusStyle(fromStage.status);
  const isUpstreamDone = ['completed', 'partial'].includes(fromStage.status);
  const connectorColor = isUpstreamDone ? fromStyle.color : '#d1d5db';
  
  // Find downstream stage to compute gate
  // This connector is placed between fromStage and the next stage in the linear chain
  const downstreamDep = stages.find(s => STAGE_DEPENDENCIES[s.id] === fromStage.id);
  const gate: GateResult = downstreamDep 
    ? computeStageGate(fromStage.status, fromStage.failed, fromStage.total)
    : { state: 'pending' };

  return (
    <div className="pipeline-connector">
      <div 
        className="pipeline-connector-line" 
        style={{ background: connectorColor } as React.CSSProperties}
      />
      <GateIcon gate={gate} />
    </div>
  );
}

// ─── Single Stage Node ────────────────────────────────────────

function StageNode({
  stage,
  isActive,
  onClick,
}: {
  stage: StageInfo;
  isActive: boolean;
  onClick: () => void;
}) {
  const style = getStatusStyle(stage.status);
  const statusClass = stage.isSkipped ? 'skipped' : stage.status;

  return (
    <div
      className={`pipeline-stage-node ${statusClass} ${isActive ? 'active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      aria-label={`${stage.label} — ${style.label}`}
    >
      <div
        className="pipeline-stage-circle"
        style={{
          '--stage-color': style.color,
          '--stage-bg': style.bgColor,
          borderColor: style.borderColor,
        } as React.CSSProperties}
      >
        {STAGE_ICONS[stage.id]}
      </div>

      <span className="pipeline-stage-label" style={{ color: style.color }}>
        {stage.label}
      </span>

      {/* Mini-summary badge */}
      {!stage.isSkipped && stage.total > 0 && (
        <span className="pipeline-stage-badge">
          <span>{stage.processed}/{stage.total}</span>
          {stage.failed > 0 && (
            <span className="failed-count">✕{stage.failed}</span>
          )}
        </span>
      )}
      {stage.isSkipped && (
        <span className="pipeline-stage-badge" style={{ opacity: 0.5 }}>
          N/A
        </span>
      )}
    </div>
  );
}

// ─── Fork Branch Connector ────────────────────────────────────

function ForkBranchConnector({ 
  parentStage, 
}: { 
  parentStage: StageInfo;
}) {
  const parentStyle = getStatusStyle(parentStage.status);
  const isParentDone = ['completed', 'partial'].includes(parentStage.status);
  const connectorColor = isParentDone ? parentStyle.color : '#d1d5db';
  
  const gate = computeStageGate(parentStage.status, parentStage.failed, parentStage.total);

  return (
    <div className="pipeline-connector" style={{ width: 40, minWidth: 28 }}>
      <div 
        className="pipeline-connector-line"
        style={{ background: connectorColor } as React.CSSProperties}
      />
      <GateIcon gate={gate} />
    </div>
  );
}

// ─── Main Stepper Component ──────────────────────────────────

interface PipelineStepperProps {
  stages: StageInfo[];
  activeStage: PipelineStage;
  onStageClick: (stage: PipelineStage) => void;
}

export default function PipelineStepper({ stages, activeStage, onStageClick }: PipelineStepperProps) {
  const ingestion = stages.find(s => s.id === 'ingestion')!;
  const transcode = stages.find(s => s.id === 'transcode')!;
  const embeddings = stages.find(s => s.id === 'embeddings')!;
  const peaks = stages.find(s => s.id === 'peaks')!;
  const segments = stages.find(s => s.id === 'segments')!;

  return (
    <div className="pipeline-stepper">
      <div className="pipeline-main-row">
        {/* Ingestion */}
        <StageNode
          stage={ingestion}
          isActive={activeStage === 'ingestion'}
          onClick={() => onStageClick('ingestion')}
        />

        {/* Connector: Ingestion → Transcode */}
        <Connector fromStage={ingestion} stages={stages} />

        {/* Transcode */}
        <StageNode
          stage={transcode}
          isActive={activeStage === 'transcode'}
          onClick={() => onStageClick('transcode')}
        />

        {/* Fork point: Transcode splits into 3 parallel branches */}
        <div className="pipeline-fork-container">
          <div className="pipeline-fork-branches">
            {/* Branch 1: Embedding */}
            <div className="pipeline-fork-branch">
              <ForkBranchConnector parentStage={transcode} />
              <StageNode
                stage={embeddings}
                isActive={activeStage === 'embeddings'}
                onClick={() => onStageClick('embeddings')}
              />
            </div>

            {/* Branch 2: Peaks */}
            <div className="pipeline-fork-branch">
              <ForkBranchConnector parentStage={transcode} />
              <StageNode
                stage={peaks}
                isActive={activeStage === 'peaks'}
                onClick={() => onStageClick('peaks')}
              />
            </div>

            {/* Branch 3: Segments */}
            <div className="pipeline-fork-branch">
              <ForkBranchConnector parentStage={transcode} />
              <StageNode
                stage={segments}
                isActive={activeStage === 'segments'}
                onClick={() => onStageClick('segments')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
