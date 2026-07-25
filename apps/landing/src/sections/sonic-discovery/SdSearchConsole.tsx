import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  barsPath,
  blocksOf,
  blocksRowOf,
  DIMNAMES,
  energyD,
  explOf,
  getRef,
  keynote,
  pulsesOf,
  rankedList,
  ridgeD,
  topDims,
  type Ref,
  type RefState,
  type Track,
} from './sdEngine.ts';

interface SdSearchConsoleProps {
  refState: RefState;
  onRefStateChange: (state: RefState) => void;
  openRow: number | null;
  onOpenRowChange: (index: number | null) => void;
  onAddToShortlist: (track: Track) => void;
  onChainDiscovery: (track: Track) => void;
  onScrollToConsoleTop: () => void;
  motionOn: boolean;
}

function brightLabel(bright: number): string {
  if (bright < 0.4) return 'dark';
  if (bright > 0.55) return 'bright';
  return 'balanced';
}

function MiniContour({ track }: { track: Track }) {
  return (
    <svg
      viewBox="0 0 130 30"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="sd-rcontour"
    >
      <path
        d={energyD(track, 2, 4, 126, 22)}
        fill="none"
        stroke="rgba(255,255,255,.6)"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function GroovePanel({ refTrack, matchTrack }: { refTrack: Ref; matchTrack: Track }) {
  const refPulses = pulsesOf(refTrack.t, refTrack.dens, 4, 40, 292, 30, 24);
  const matchPulses = pulsesOf(matchTrack.t, matchTrack.dens, 4, 78, 292, 30, 24);

  return (
    <svg viewBox="0 0 300 84" preserveAspectRatio="none" aria-hidden="true">
      <g>
        {Array.from({ length: 16 }, (_, i) => (
          <line
            key={`grid-${i}`}
            x1={4 + i * 18.5}
            y1={6}
            x2={4 + i * 18.5}
            y2={78}
            stroke="rgba(255,255,255,.1)"
          />
        ))}
        {refPulses.map((p, i) => (
          <rect
            key={`ref-${i}`}
            x={p.x}
            y={p.y}
            width={p.width}
            height={p.height}
            fill={p.acc ? '#fff' : 'rgba(255,255,255,.65)'}
            opacity={p.acc ? 0.95 : 0.65}
          />
        ))}
        {matchPulses.map((p, i) => (
          <rect
            key={`match-${i}`}
            x={p.x}
            y={p.y}
            width={p.width}
            height={p.height}
            fill="none"
            stroke="#EE4A26"
            strokeWidth={1}
            opacity={0.9}
          />
        ))}
      </g>
    </svg>
  );
}

function StructurePanel({ refTrack, matchTrack }: { refTrack: Ref; matchTrack: Track }) {
  const refBlocks = blocksRowOf(refTrack.t, 4, 10, 292, 24, 'rgba(255,255,255,.55)', false);
  const matchBlocks = blocksRowOf(matchTrack.t, 4, 52, 292, 24, 'rgba(238,74,38,.9)', false);
  const refStructure = blocksOf(refTrack.t);
  const matchStructure = blocksOf(matchTrack.t);

  return (
    <svg viewBox="0 0 300 84" preserveAspectRatio="none" aria-hidden="true">
      <g>
        {refBlocks.map((b) => (
          <rect
            key={`ref-${b.label}-${b.x}`}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill="none"
            stroke={b.hot ? '#EE4A26' : 'rgba(255,255,255,.55)'}
            strokeWidth={b.hot ? 1.4 : 1}
            opacity={b.hot ? 0.95 : 0.8}
          />
        ))}
        {matchBlocks.map((b) => (
          <rect
            key={`match-${b.label}-${b.x}`}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill="none"
            stroke={b.hot ? '#EE4A26' : 'rgba(238,74,38,.9)'}
            strokeWidth={b.hot ? 1.4 : 1}
            opacity={b.hot ? 0.95 : 0.8}
          />
        ))}
        {refStructure.map((b, i) => {
          const cb = matchStructure[i];
          if (!cb) return null;
          return (
            <line
              key={`tick-${i}`}
              x1={4 + (b.x + b.w / 2) * 292}
              y1={34}
              x2={4 + (cb.x + cb.w / 2) * 292}
              y2={52}
              stroke="rgba(255,255,255,.25)"
              strokeDasharray="1 3"
            />
          );
        })}
      </g>
    </svg>
  );
}

interface MatchLabProps {
  refTrack: Ref;
  matchTrack: Track;
  previewOn: boolean;
  onPreviewToggle: () => void;
  onAdd: () => void;
  onChain: () => void;
}

function MatchLab({
  refTrack,
  matchTrack,
  previewOn,
  onPreviewToggle,
  onAdd,
  onChain,
}: MatchLabProps) {
  const { t } = useTranslation('common');
  const dims = topDims(matchTrack);

  return (
    <>
      <div className="sd-matchlab-head">
        <span className="sd-hudlbl uppercase">
          {t('sonicDiscovery.console.labTitle')} · {refTrack.t} ↔ {matchTrack.t}
        </span>
        <span className="sd-truth uppercase">{t('sonicDiscovery.console.labTruth')}</span>
      </div>
      <div className="sd-matchlab-body">
        <div className="sd-mgrid">
          <div className="sd-mpanel" style={{ gridColumn: '1 / -1' }}>
            <span className="sd-lbl">
              <span>{t('sonicDiscovery.console.labWave')}</span>
              <span className="sd-lbl-dim">{t('sonicDiscovery.console.labWaveNote')}</span>
            </span>
            <svg viewBox="0 0 640 100" preserveAspectRatio="none" aria-hidden="true">
              <path
                d={barsPath(refTrack.t, 2, 26, 636, 42, 110)}
                stroke="rgba(255,255,255,.75)"
                strokeWidth="1.8"
                fill="none"
              />
              <path
                d={barsPath(matchTrack.t, 2, 74, 636, 42, 110)}
                stroke="#EE4A26"
                strokeWidth="1.8"
                fill="none"
                opacity="0.85"
              />
              <line
                x1={2}
                y1={50}
                x2={638}
                y2={50}
                stroke="rgba(255,255,255,.12)"
                strokeDasharray="1 4"
              />
            </svg>
          </div>

          <div className="sd-mpanel">
            <span className="sd-lbl">
              <span>{t('sonicDiscovery.console.labGroove')}</span>
              <span className="sd-lbl-dim">{t('sonicDiscovery.console.labGrooveNote')}</span>
            </span>
            <GroovePanel refTrack={refTrack} matchTrack={matchTrack} />
          </div>

          <div className="sd-mpanel">
            <span className="sd-lbl">
              <span>{t('sonicDiscovery.console.labEnergy')}</span>
              <span className="sd-lbl-dim">{t('sonicDiscovery.console.labEnergyNote')}</span>
            </span>
            <svg viewBox="0 0 300 84" preserveAspectRatio="none" aria-hidden="true">
              <path
                d={energyD(refTrack, 4, 6, 292, 72)}
                stroke="rgba(255,255,255,.75)"
                strokeWidth="1.4"
                fill="none"
              />
              <path
                d={energyD(matchTrack, 4, 6, 292, 72)}
                stroke="#EE4A26"
                strokeWidth="1.4"
                fill="none"
                opacity="0.9"
              />
            </svg>
          </div>

          <div className="sd-mpanel">
            <span className="sd-lbl">
              <span>{t('sonicDiscovery.console.labTimbre')}</span>
              <span className="sd-lbl-dim">{t('sonicDiscovery.console.labTimbreNote')}</span>
            </span>
            <svg viewBox="0 0 300 84" preserveAspectRatio="none" aria-hidden="true">
              <path
                d={ridgeD(refTrack.t, 1, refTrack.bright, 4, 78, 292, 64, true)}
                fill="rgba(255,255,255,.07)"
                stroke="rgba(255,255,255,.6)"
                strokeWidth="1"
              />
              <path
                d={ridgeD(matchTrack.t, 1, matchTrack.bright, 4, 78, 292, 64, true)}
                fill="rgba(238,74,38,.10)"
                stroke="#EE4A26"
                strokeWidth="1"
                opacity="0.9"
              />
            </svg>
          </div>

          <div className="sd-mpanel">
            <span className="sd-lbl">
              <span>{t('sonicDiscovery.console.labStruct')}</span>
              <span className="sd-lbl-dim">{t('sonicDiscovery.console.labStructNote')}</span>
            </span>
            <StructurePanel refTrack={refTrack} matchTrack={matchTrack} />
          </div>
        </div>

        <div className="sd-mlegend">
          <span>
            <i aria-hidden="true" />
            {t('sonicDiscovery.console.legendRef')}
          </span>
          <span>
            <i className="sd-oi" aria-hidden="true" />
            {t('sonicDiscovery.console.legendMatch')}
          </span>
          <span className="sd-lbl-dim">
            {DIMNAMES[dims[0]]} + {DIMNAMES[dims[1]]} carry this match
          </span>
        </div>

        <p className="sd-mkey">{keynote(matchTrack, refTrack)}</p>
        <p className="sd-mexpl">{explOf(matchTrack)}</p>

        <div className="sd-mactions">
          <button
            type="button"
            className="sd-iconbtn min-h-[var(--px-44)]"
            aria-pressed={previewOn}
            aria-label={`Preview ${matchTrack.t} (simulated)`}
            onClick={onPreviewToggle}
          >
            {previewOn
              ? `❚❚ ${t('sonicDiscovery.console.actPreviewOn')}`
              : `▶ ${t('sonicDiscovery.console.actPreview')}`}
          </button>
          <button
            type="button"
            className="sd-iconbtn min-h-[var(--px-44)]"
            aria-label={`Add ${matchTrack.t} to the shortlist`}
            onClick={onAdd}
          >
            + {t('sonicDiscovery.console.actAdd')}
          </button>
          <button
            type="button"
            className="sd-iconbtn min-h-[var(--px-44)]"
            aria-label={`Chain discovery: search again from ${matchTrack.t}`}
            onClick={onChain}
          >
            ⤴ {t('sonicDiscovery.console.actChain')}
          </button>
        </div>
      </div>
    </>
  );
}

export function SdSearchConsole({
  refState,
  onRefStateChange,
  openRow,
  onOpenRowChange,
  onAddToShortlist,
  onChainDiscovery,
  onScrollToConsoleTop,
  motionOn,
}: SdSearchConsoleProps) {
  const { t } = useTranslation('common');
  const refwaveWrapRef = useRef<HTMLDivElement>(null);
  const [previewRows, setPreviewRows] = useState<Record<number, boolean>>({});

  const refTrack = useMemo(() => getRef(refState), [refState]);
  const results = useMemo(() => rankedList(refTrack), [refTrack]);

  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const host = refwaveWrapRef.current;
    if (!host) return;

    const paths = host.querySelectorAll<SVGPathElement>('.sd-draw');
    paths.forEach((path) => {
      try {
        const len = Math.ceil(path.getTotalLength());
        path.style.strokeDasharray = String(len);
        path.style.setProperty('--len', String(len));
        path.style.strokeDashoffset = String(len);
        path.classList.add('sd-armed');
      } catch {
        /* non-path or zero-length stroke */
      }
    });

    const settle = (path: SVGPathElement) => {
      path.style.strokeDasharray = 'none';
      path.style.strokeDashoffset = '0';
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && entry.intersectionRatio <= 0) return;
          io.unobserve(entry.target);
          entry.target.querySelectorAll<SVGPathElement>('.sd-draw').forEach((path) => {
            path.classList.add('sd-play');
            path.addEventListener('animationend', () => settle(path), { once: true });
            setTimeout(() => settle(path), 1400);
          });
        });
      },
      { threshold: [0, 0.01] },
    );

    io.observe(host);
    return () => io.disconnect();
  }, [motionOn, refTrack.t]);

  const handleMethodChange = (ref: 'int' | 'up') => {
    onRefStateChange({ ref, custom: null });
    onOpenRowChange(null);
    setPreviewRows({});
  };

  const handleRowToggle = (index: number) => {
    onOpenRowChange(openRow === index ? null : index);
  };

  const handleChainDiscovery = (track: Track) => {
    const currentRef = getRef(refState);
    const customRef: Ref = {
      t: track.t,
      a: track.a,
      bpm: track.bpm,
      key: track.key,
      dur: track.dur,
      e: Math.min(1, Math.max(0.15, currentRef.e + track.de)),
      bright: track.bright,
      dens: track.dens,
      voc: track.voc,
      status: 'chain discovery from result · sample data',
    };
    onRefStateChange({ ...refState, custom: customRef });
    onOpenRowChange(null);
    setPreviewRows({});
    onChainDiscovery(track);
    onScrollToConsoleTop();
  };

  const bright = brightLabel(refTrack.bright);

  return (
    <section id="sd-demo" className="sd-section" aria-label="Interactive sonic search demonstration">
      <header className="sd-dim-intro">
        <p className="sd-eyebrow uppercase">{t('sonicDiscovery.console.eyebrow')}</p>
        <h2 className="sd-h2b uppercase">{t('sonicDiscovery.console.title')}</h2>
        <p className="sd-lead">{t('sonicDiscovery.console.lead')}</p>
      </header>

      <div className="sd-console">
        <div className="sd-console-head">
          <span className="sd-hudlbl uppercase">
            <span className="sd-dotlive" aria-hidden="true" />
            {t('sonicDiscovery.console.head')}
          </span>
          <span className="sd-truth uppercase">{t('sonicDiscovery.console.truth')}</span>
        </div>

        <div className="sd-stage" id="sd-stage-ref">
          <div className="sd-stagetag">
            <span className="sd-n">{t('sonicDiscovery.console.s1n')}</span>
            <span className="sd-t">{t('sonicDiscovery.console.s1t')}</span>
            <span className="sd-note sd-lbl-dim">{refTrack.status}</span>
          </div>

          <div className="sd-refband">
            <div>
              <div className="sd-seg" role="group" aria-label="Similarity method">
                <button
                  type="button"
                  className="min-h-[var(--px-44)]"
                  data-ref="int"
                  aria-pressed={!refState.custom && refState.ref === 'int'}
                  onClick={() => handleMethodChange('int')}
                >
                  {t('sonicDiscovery.console.methodInternal')}
                </button>
                <button
                  type="button"
                  className="min-h-[var(--px-44)]"
                  data-ref="up"
                  aria-pressed={!refState.custom && refState.ref === 'up'}
                  onClick={() => handleMethodChange('up')}
                >
                  {t('sonicDiscovery.console.methodUpload')}
                </button>
              </div>

              <div className="sd-refid">
                <div className="sd-art" aria-hidden="true">
                  <svg width="38" height="38" viewBox="0 0 38 38">
                    <path
                      d="M7 27 V11 h4 v16 z M16 27 V7 h4 v20 z M25 27 V15 h4 v12 z"
                      fill="#EE4A26"
                      opacity=".85"
                    />
                  </svg>
                </div>
                <div>
                  <div className="sd-reftitle">{refTrack.t}</div>
                  <div className="sd-refartist">{refTrack.a}</div>
                </div>
              </div>

              <div className="sd-refmeta">
                <span className="sd-chip">
                  <b>{refTrack.bpm}</b> BPM
                </span>
                <span className="sd-chip">
                  <b>{refTrack.key}</b> camelot
                </span>
                <span className="sd-chip">
                  <b>{refTrack.dur}</b>
                </span>
                <span className="sd-chip">
                  energy <b>{Math.round(refTrack.e * 100)}</b>
                </span>
                <span className="sd-chip">
                  timbre <b>{bright}</b>
                </span>
              </div>
            </div>

            <div className="sd-refwave-wrap" ref={refwaveWrapRef}>
              <span className="sd-lbl">{t('sonicDiscovery.console.waveLabel')}</span>
              <svg
                className="sd-refwave"
                viewBox="0 0 720 132"
                preserveAspectRatio="none"
                role="img"
                aria-label={t('sonicDiscovery.console.waveAlt')}
              >
                <path
                  className="sd-draw"
                  d={barsPath(refTrack.t, 4, 52, 712, 84, 120)}
                  stroke="rgba(255,255,255,.8)"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  className="sd-draw sd-d2"
                  d={energyD(refTrack, 4, 10, 712, 84)}
                  stroke="#EE4A26"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.9"
                />
                {blocksOf(refTrack.t).map((block) => (
                  <rect
                    key={`${block.label}-${block.x}`}
                    x={4 + block.x * 712}
                    y={104}
                    width={block.w * 712 - 3}
                    height={18}
                    fill="none"
                    stroke={block.label === 'drop' ? '#EE4A26' : 'rgba(255,255,255,.35)'}
                    strokeWidth="1"
                  />
                ))}
              </svg>
              <div className="sd-refwave-foot">
                <span className="sd-lbl-dim">{t('sonicDiscovery.console.waveFoot1')}</span>
                <span className="sd-lbl-dim">{t('sonicDiscovery.console.waveFoot2')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sd-stage" id="sd-stage-results">
          <div className="sd-stagetag">
            <span className="sd-n">{t('sonicDiscovery.console.s2n')}</span>
            <span className="sd-t">{t('sonicDiscovery.console.s2t')}</span>
            <span className="sd-note sd-lbl-dim">{t('sonicDiscovery.console.s2note')}</span>
          </div>

          <ol className="sd-results" aria-live="polite">
            {results.map(({ t: track, sc }, index) => {
              const dims = topDims(track);
              const isOpen = openRow === index;

              return (
                <li key={track.t} className="sd-rrow" data-open={isOpen ? 'true' : 'false'}>
                  <button
                    type="button"
                    className="sd-rhead min-h-[var(--px-44)]"
                    aria-expanded={isOpen}
                    onClick={() => handleRowToggle(index)}
                  >
                    <span className="sd-rank">0{index + 1}</span>
                    <span>
                      <span className="sd-rtitle">{track.t}</span>
                      <span className="sd-rartist">{track.a}</span>
                      <span className="sd-rattrs">
                        {dims.map((dim, dimIndex) => (
                          <span
                            key={dim}
                            className={`sd-rattr${dimIndex === 0 ? ' sd-hot' : ''}`}
                          >
                            {DIMNAMES[dim]}
                          </span>
                        ))}
                        <span className="sd-rattr">
                          {track.bpm} BPM · {track.key}
                        </span>
                      </span>
                    </span>
                    <span className="sd-rcontour-cell">
                      <MiniContour track={track} />
                      <span className="sd-redir">energy contour</span>
                    </span>
                    <span className="sd-score">{sc}</span>
                    <span className="sd-rcaret">▾</span>
                  </button>

                  <div
                    className="sd-matchlab"
                    role="region"
                    aria-label={`Why this match — ${track.t}`}
                  >
                    <MatchLab
                      refTrack={refTrack}
                      matchTrack={track}
                      previewOn={Boolean(previewRows[index])}
                      onPreviewToggle={() =>
                        setPreviewRows((prev) => ({
                          ...prev,
                          [index]: !prev[index],
                        }))
                      }
                      onAdd={() => onAddToShortlist(track)}
                      onChain={() => handleChainDiscovery(track)}
                    />
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="sd-results-foot">
            <span className="sd-lbl-dim">{t('sonicDiscovery.console.foot')}</span>
            <span className="sd-truth uppercase">{t('sonicDiscovery.console.labTruth')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
