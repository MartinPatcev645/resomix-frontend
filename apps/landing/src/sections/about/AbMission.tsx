import { useTranslation } from 'react-i18next';

/* S2 · Our mission — metadata frame around the audio-derived evidence panel;
   geometry transplanted verbatim from the approved preview (`#ab-s2`). */
export function AbMission() {
  const { t } = useTranslation('common');
  const f = (key: string) => t(`about.figures.${key}`);

  return (
    <section className="ab-sec ab-section" id="ab-s2">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.mission.eyebrow')}</div>
        <h2 className="ab-h2">{t('about.mission.h2')}</h2>
        <div className="ab-split">
          <div>
            <p className="ab-body-p">{t('about.mission.body1')}</p>
            <p className="ab-body-p">{t('about.mission.body2')}</p>
            <p className="ab-body-p">{t('about.mission.body3')}</p>
          </div>
          <div className="ab-stagebox" style={{ padding: '0' }}>
            <div className="ab-grain" aria-hidden="true" />

            {/* ============ METADATA FRAME + EVIDENCE PANEL ============ */}
            <svg viewBox="0 0 560 470" role="img" aria-label={t('about.mission.figureAria')}>
              <rect x="30" y="30" width="500" height="410" fill="none" stroke="rgba(255,255,255,.36)" />
              <text x="46" y="58" fontSize="12.5" letterSpacing="1.6" fill="rgba(185,185,185,.92)">
                {f('usefulContext')}
              </text>
              <g fontSize="10.8" letterSpacing="1.2" fill="rgba(185,185,185,.6)">
                <text x="46" y="84">{f('title')}</text>
                <text x="130" y="84">{f('artist')}</text>
                <text x="226" y="84">{f('genre')}</text>
                <text x="318" y="84">{f('releaseDate')}</text>
                <text x="452" y="84">{f('label')}</text>
              </g>
              <rect x="64" y="112" width="432" height="290" fill="#141416" stroke="rgba(255,255,255,.36)" />
              <text x="82" y="140" fontSize="12.5" letterSpacing="1.6" fill="rgba(255,255,255,.94)">
                {f('audioDerivedEvidence')}
              </text>
              <g fontSize="11.5" letterSpacing="1.2" fill="rgba(185,185,185,.92)">
                <text x="82" y="176">{f('rhythm')}</text>
                <text x="82" y="216">{f('harmony')}</text>
                <text x="82" y="256">{f('timbre')}</text>
                <text x="82" y="296">{f('structure')}</text>
                <text x="82" y="336">{f('energy')}</text>
              </g>
              <g stroke="rgba(255,255,255,.52)">
                <path
                  d="M 196 172 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6"
                  fill="none"
                />
                <path
                  d="M 196 212 C 220 204, 244 220, 268 212 C 292 204, 316 220, 340 212 C 364 204, 388 220, 412 212 C 436 204, 460 220, 476 212"
                  fill="none"
                />
                <path
                  d="M 196 252 C 232 244, 260 262, 300 250 C 340 240, 400 262, 476 252"
                  fill="none"
                  strokeDasharray="3 4"
                />
                <path d="M 196 292 H 236 V 286 H 278 V 298 H 330 V 288 H 392 V 296 H 476" fill="none" />
                <path
                  d="M 196 332 C 250 326, 300 314, 350 310 C 400 308, 448 320, 476 328"
                  fill="none"
                />
              </g>
              <rect x="150" y="358" width="262" height="22" fill="none" stroke="rgba(255,255,255,.36)" />
              <text x="281" y="373" fontSize="11.5" letterSpacing="1.4" textAnchor="middle" fill="rgba(185,185,185,.94)">
                {f('characteristics70Measurable')}
              </text>
              <path
                className="ab-sig"
                d="M 30 440 H 64 M 64 440 C 160 434, 210 420, 240 402"
                fill="none"
                stroke="#EE4A26"
              />
            </svg>
          </div>
        </div>
        <p className="ab-interp">{t('about.mission.interp')}</p>
      </div>
    </section>
  );
}
