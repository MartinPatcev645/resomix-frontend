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
import { getStatusStyle, computeStageGate } from './pipelineUtils.js';
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

// ─── Fork Line Connector ──────────────────────────────────────

function ForkLine({ parent }: { parent: StageInfo }) {
  const parentStyle = getStatusStyle(parent.status);
  const isParentDone = ['completed', 'partial'].includes(parent.status);
  const connectorColor = isParentDone ? parentStyle.color : '#d1d5db';
  
  const gate = computeStageGate(parent.status, parent.failed, parent.total);

  return (
    <div className="pipeline-fork-line-container">
      <div 
        className="pipeline-fork-line"
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

  const getForkStyle = (parent: StageInfo) => {
    const parentStyle = getStatusStyle(parent.status);
    const isParentDone = ['completed', 'partial'].includes(parent.status);
    const forkColor = isParentDone ? parentStyle.color : '#d1d5db';
    return { '--fork-line-color': forkColor } as React.CSSProperties;
  };

  return (
    <div className="pipeline-stepper-v2">
      <div className="pipeline-root-node">
        {/* Stage 1: Ingestion */}
        <StageNode
          stage={ingestion}
          isActive={activeStage === 'ingestion'}
          onClick={() => onStageClick('ingestion')}
        />
      </div>

      {/* Fork 1: Ingestion splits into Embeddings and Transcode */}
      <div className="pipeline-fork-group" style={getForkStyle(ingestion)}>
        <ForkLine parent={ingestion} />
        
        <div className="pipeline-fork-destinations">
          {/* Path 1: Embeddings (Critical Path) */}
          <div className="pipeline-path-row">
            <StageNode
              stage={embeddings}
              isActive={activeStage === 'embeddings'}
              onClick={() => onStageClick('embeddings')}
            />
            <span className="pipeline-path-badge critical-path">Critical Path</span>
          </div>

          {/* Path 2: Transcode (which splits into Peaks and Segments) */}
          <div className="pipeline-path-row transcode-path-row">
            <div className="pipeline-node-wrapper">
              <StageNode
                stage={transcode}
                isActive={activeStage === 'transcode'}
                onClick={() => onStageClick('transcode')}
              />
            </div>

            {/* Fork 2: Transcode splits into Peaks and Segments */}
            <div className="pipeline-fork-group sub-fork" style={getForkStyle(transcode)}>
              <ForkLine parent={transcode} />
              
              <div className="pipeline-fork-destinations">
                <div className="pipeline-path-row">
                  <StageNode
                    stage={peaks}
                    isActive={activeStage === 'peaks'}
                    onClick={() => onStageClick('peaks')}
                  />
                </div>
                <div className="pipeline-path-row">
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
      </div>
    </div>
  );
}
