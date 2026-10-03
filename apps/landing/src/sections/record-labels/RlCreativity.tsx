import { useTranslation, Trans } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

export function RlCreativity() {
  const { t } = useTranslation('common');

  return (
    <section className="rl-section" id="rl-creativity">
      <div className="rl-frame">
        <div className="rl-cr-grid">
          <div>
            <p className="rl-eyebrow uppercase">{t('recordLabels.creativity.eyebrow')}</p>
            <h2 className="rl-h2b uppercase">{t('recordLabels.creativity.h2')}</h2>
            <p className="rl-body">{t('recordLabels.creativity.p1')}</p>
            <p className="rl-body">{t('recordLabels.creativity.p2')}</p>
            <p className="rl-body rl-body-emph"><Trans i18nKey="recordLabels.creativity.p3" components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={BLOG.story} /> }} /></p>
          </div>

          <figure
            className="rl-fig"
            role="img"
            aria-label={t('recordLabels.creativity.figureAria')}
          >
            {/* Illustrative — fictional catalogue field / surfaced set. */}
            <svg className="rl-sl" viewBox="0 0 560 380" aria-hidden="true">
              <text x="32" y="38" fontSize="11">
                {t('recordLabels.figures.yourCatalogue')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.28)' }}>
                <circle cx="120" cy="100" r="2.6" />
                <circle cx="150" cy="84" r="2.6" />
                <circle cx="172" cy="112" r="2.6" />
                <circle cx="136" cy="136" r="2.6" />
                <circle cx="196" cy="92" r="2.6" />
                <circle cx="220" cy="128" r="2.6" />
                <circle cx="176" cy="160" r="2.6" />
                <circle cx="130" cy="182" r="2.6" />
                <circle cx="238" cy="164" r="2.6" />
                <circle cx="204" cy="196" r="2.6" />
                <circle cx="152" cy="216" r="2.6" />
                <circle cx="256" cy="200" r="2.6" />
                <circle cx="290" cy="120" r="2.6" />
                <circle cx="320" cy="96" r="2.6" />
                <circle cx="344" cy="132" r="2.6" />
                <circle cx="310" cy="160" r="2.6" />
                <circle cx="370" cy="108" r="2.6" />
                <circle cx="396" cy="148" r="2.6" />
                <circle cx="352" cy="188" r="2.6" />
                <circle cx="418" cy="180" r="2.6" />
                <circle cx="386" cy="216" r="2.6" />
                <circle cx="440" cy="120" r="2.6" />
                <circle cx="462" cy="156" r="2.6" />
                <circle cx="486" cy="132" r="2.6" />
                <circle cx="448" cy="204" r="2.6" />
                <circle cx="300" cy="240" r="2.6" />
                <circle cx="340" cy="260" r="2.6" />
                <circle cx="260" cy="256" r="2.6" />
                <circle cx="380" cy="252" r="2.6" />
                <circle cx="420" cy="244" r="2.6" />
              </g>
              <g style={{ color: 'rgba(238,74,38,.65)' }}>
                <circle cx="220" cy="128" r="8" style={{ strokeWidth: 1.6 }} />
                <circle cx="344" cy="132" r="8" style={{ strokeWidth: 1.6 }} />
                <circle cx="386" cy="216" r="8" style={{ strokeWidth: 1.6 }} />
              </g>
              <g style={{ color: 'rgba(238,74,38,.35)' }}>
                <path className="rl-dashflow" d="M220 128 C 260 128 300 130 336 132" />
                <path className="rl-dashflow" d="M344 140 C 358 166 372 192 382 208" />
              </g>
              <text x="188" y="308" fontSize="10.5">
                {t('recordLabels.figures.surfaced')}
              </text>
              <circle cx="344" cy="132" r="15" style={{ color: 'rgba(255,255,255,.85)', strokeWidth: 1.8 }} />
              <text x="368" y="88" fontSize="11" style={{ fill: '#d8d8d8' }}>
                {t('recordLabels.figures.yourChoice')}
              </text>
              <path d="M366 92 C 358 102 352 112 348 120" style={{ color: 'rgba(255,255,255,.3)' }} />
            </svg>
            <figcaption>
              <span>{t('recordLabels.figures.engineSurfaces')}</span>
              <span>{t('recordLabels.figures.youChoose')}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
