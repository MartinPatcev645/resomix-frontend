import { useTranslation } from 'react-i18next';

export function DjLibrary() {
  const { t } = useTranslation('common');

  return (
    <section className="dj-section" id="dj-library">
      <div className="dj-frame">
        <div className="dj-asset-grid">
          <div>
            <p className="dj-eyebrow uppercase">{t('djs.library.eyebrow')}</p>
            <h2 className="dj-h2b uppercase">{t('djs.library.h2')}</h2>
            <p className="dj-body">{t('djs.library.p1')}</p>
            <p className="dj-body">{t('djs.library.p2')}</p>
            <p className="dj-body">{t('djs.library.p3')}</p>
            <p className="dj-body">{t('djs.library.p4')}</p>
            <p className="dj-pull dj-pull-gap">{t('djs.library.pull')}</p>
            <p className="dj-body">{t('djs.library.p5')}</p>
            <p className="dj-body dj-body-soft">{t('djs.library.p6')}</p>
          </div>

          <figure
            className="dj-fig"
            role="img"
            aria-label={t('djs.library.figureAria')}
          >
            {/* Illustrative — library as depth; latest bright, signatures pinned, gems glint. */}
            <svg className="dj-sl" viewBox="0 0 560 420" aria-hidden="true">
              <text x="36" y="38" style={{ fontSize: '11px' }}>
                {t('djs.figures.theLibrary')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.5)' }}>
                <path d="M60 64 V96 M70 58 V96 M80 68 V96 M90 54 V96 M100 62 V96 M110 58 V96 M120 70 V96 M130 56 V96 M140 66 V96 M150 60 V96 M160 68 V96 M170 56 V96" />
              </g>
              <text x="196" y="82" style={{ fontSize: '10.5px', fill: '#c9c9c9' }}>
                {t('djs.figures.latestEntries')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.55)' }}>
                <circle cx="430" cy="70" r="9" style={{ strokeWidth: 1.5 }} />
                <circle cx="466" cy="70" r="9" style={{ strokeWidth: 1.5 }} />
                <circle cx="502" cy="70" r="9" style={{ strokeWidth: 1.5 }} />
              </g>
              <text x="466" y="106" textAnchor="middle" style={{ fontSize: '10px' }}>
                {t('djs.figures.signatureSongs')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.16)' }}>
                <path d="M60 146 V174 M72 140 V174 M84 150 V174 M96 138 V174 M108 146 V174 M120 142 V174 M132 152 V174 M144 138 V174 M156 148 V174 M168 144 V174 M180 152 V174 M192 140 V174 M204 146 V174 M216 150 V174 M228 138 V174 M240 144 V174 M252 152 V174 M264 142 V174 M276 148 V174 M288 138 V174 M300 146 V174 M312 150 V174 M324 140 V174 M336 144 V174 M348 152 V174 M360 138 V174 M372 148 V174 M384 142 V174 M396 152 V174 M408 144 V174 M420 138 V174 M432 146 V174 M444 150 V174 M456 140 V174 M468 148 V174 M480 144 V174 M492 138 V174 M504 152 V174" />
                <path d="M60 216 V244 M72 210 V244 M84 220 V244 M96 208 V244 M108 216 V244 M120 212 V244 M132 222 V244 M144 208 V244 M156 218 V244 M168 214 V244 M180 222 V244 M192 210 V244 M204 216 V244 M216 220 V244 M228 208 V244 M240 214 V244 M252 222 V244 M264 212 V244 M276 218 V244 M288 208 V244 M300 216 V244 M312 220 V244 M324 210 V244 M336 214 V244 M348 222 V244 M360 208 V244 M372 218 V244 M384 212 V244 M396 222 V244 M408 214 V244 M420 208 V244 M432 216 V244 M444 220 V244 M456 210 V244 M468 218 V244 M480 214 V244 M492 208 V244 M504 222 V244" />
                <path d="M60 286 V314 M72 280 V314 M84 290 V314 M96 278 V314 M108 286 V314 M120 282 V314 M132 292 V314 M144 278 V314 M156 288 V314 M168 284 V314 M180 292 V314 M192 280 V314 M204 286 V314 M216 290 V314 M228 278 V314 M240 284 V314 M252 292 V314 M264 282 V314 M276 288 V314 M288 278 V314 M300 286 V314 M312 290 V314 M324 280 V314 M336 284 V314 M348 292 V314 M360 278 V314 M372 288 V314 M384 282 V314 M396 292 V314 M408 284 V314 M420 278 V314 M432 286 V314 M444 290 V314 M456 280 V314 M468 288 V314 M480 284 V314 M492 278 V314 M504 292 V314" />
              </g>
              <circle
                className="dj-glowp"
                cx="168"
                cy="158"
                r="3"
                style={{ fill: '#EE4A26', stroke: 'none' }}
              />
              <circle
                className="dj-glowp"
                cx="396"
                cy="230"
                r="3"
                style={{ fill: '#EE4A26', stroke: 'none' }}
              />
              <circle
                className="dj-glowp"
                cx="252"
                cy="300"
                r="3"
                style={{ fill: '#EE4A26', stroke: 'none' }}
              />
              <text x="60" y="360" style={{ fontSize: '10px' }}>
                {t('djs.figures.tensDeep')}
              </text>
              <text x="380" y="360" style={{ fontSize: '10px', fill: '#EE4A26' }}>
                {t('djs.figures.hiddenGems')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.08)' }}>
                <line x1="36" y1="392" x2="524" y2="392" strokeDasharray="1 6" />
              </g>
            </svg>
            <figcaption>
              <span>{t('djs.figures.whatGetsPlayed')}</span>
              <span>{t('djs.figures.whatGetsForgotten')}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
