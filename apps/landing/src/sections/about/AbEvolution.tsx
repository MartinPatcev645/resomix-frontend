import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAbDefs } from './abDefs.ts';

/* S4 · Evolution — three instrument chapters (Sonic Discovery, Track
   Intelligence, Catalogue Intelligence) + subordinate API rail. Geometry
   transplanted verbatim from the approved preview (`#ab-s4`). */
export function AbEvolution() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { url } = useAbDefs();
  const f = (key: string) => t(`about.figures.${key}`);

  return (
    <section className="ab-sec ab-section" id="ab-s4">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.evolution.eyebrow')}</div>
        <h2 className="ab-h2">{t('about.evolution.h2')}</h2>
        <p className="ab-body-p ab-copycol">{t('about.evolution.intro')}</p>

        <div className="ab-inst" style={{ marginTop: '2.4rem' }}>
          <div className="ab-inst-copy">
            <span className="ab-q-label">{t('about.evolution.sd.qLabel')}</span>
            <h3>{t('about.evolution.sd.title')}</h3>
            <p>{t('about.evolution.sd.body')}</p>
            <div className="ab-outcome">{t('about.evolution.sd.outcome')}</div>
            <button type="button" className="ab-cta" onClick={() => navigate('/product/sonic-discovery')}>
              {t('about.evolution.sd.cta')}
            </button>
          </div>
          <div className="ab-inst-fig">
            <div className="ab-stagebox">
              <div className="ab-grain" aria-hidden="true" />
              <svg viewBox="0 0 560 240" role="img" aria-label={t('about.evolution.sd.figureAria')}>
                <circle cx="56" cy="120" r="20" fill={url('halo')} />
                <rect x="45" y="114" width="22" height="13" fill="#EE4A26" />
                <path className="ab-sig" d="M 70 120 H 130" fill="none" stroke="#EE4A26" />
                <circle
                  cx="162"
                  cy="120"
                  r="24"
                  fill="none"
                  stroke="rgba(255,255,255,.5)"
                  strokeDasharray="94 56"
                  transform="rotate(150 162 120)"
                />
                <rect
                  x="157"
                  y="115"
                  width="10"
                  height="10"
                  fill="#0C0C0D"
                  stroke="rgba(238,74,38,.85)"
                  transform="rotate(45 162 120)"
                />
                <path className="ab-sig" d="M 188 120 H 240" fill="none" stroke="#EE4A26" />
                <rect x="252" y="36" width="272" height="170" fill="#1C1C1F" stroke="rgba(255,255,255,.34)" />
                <g fontSize="11" letterSpacing="1">
                  <g className="ab-resolve d1">
                    <rect x="262" y="50" width="252" height="22" fill="rgba(238,74,38,.12)" />
                    <text x="272" y="65" fill="#EE4A26">
                      {f('rank01')}
                    </text>
                    <text x="304" y="65" fill="rgba(255,255,255,.95)">
                      {f('nightTransit')}
                    </text>
                    <text x="504" y="65" textAnchor="end" fill="rgba(238,74,38,.9)">
                      {f('score931')}
                    </text>
                  </g>
                  <g className="ab-resolve d2">
                    <text x="272" y="94" fill="rgba(255,255,255,.72)">
                      {f('rank02')}
                    </text>
                    <text x="304" y="94" fill="rgba(255,255,255,.9)">
                      {f('glassHarbour')}
                    </text>
                    <text x="504" y="94" textAnchor="end" fill="rgba(185,185,185,.9)">
                      {f('score924')}
                    </text>
                  </g>
                  <g className="ab-resolve d3">
                    <text x="272" y="122" fill="rgba(255,255,255,.68)">
                      {f('rank03')}
                    </text>
                    <text x="304" y="122" fill="rgba(255,255,255,.86)">
                      {f('lowAltitude')}
                    </text>
                    <text x="504" y="122" textAnchor="end" fill="rgba(185,185,185,.75)">
                      {f('score918')}
                    </text>
                  </g>
                  <g className="ab-resolve d4">
                    <text x="272" y="150" fill="rgba(255,255,255,.64)">
                      {f('rank04')}
                    </text>
                    <text x="304" y="150" fill="rgba(255,255,255,.82)">
                      {f('stillCurrent')}
                    </text>
                    <text x="504" y="150" textAnchor="end" fill="rgba(185,185,185,.7)">
                      {f('score912')}
                    </text>
                  </g>
                  <g className="ab-resolve d5">
                    <text x="272" y="178" fill="rgba(255,255,255,.6)">
                      {f('rank05')}
                    </text>
                    <text x="304" y="178" fill="rgba(255,255,255,.78)">
                      {f('paleMeridian')}
                    </text>
                    <text x="504" y="178" textAnchor="end" fill="rgba(185,185,185,.65)">
                      {f('score909')}
                    </text>
                  </g>
                </g>
                <text x="252" y="226" fontSize="10" letterSpacing="1.2" fill="rgba(185,185,185,.86)">
                  {f('rankedAutomatically')}
                </text>
              </svg>
            </div>
          </div>
        </div>

        <div className="ab-inst ab-flip">
          <div className="ab-inst-copy">
            <span className="ab-q-label">{t('about.evolution.ti.qLabel')}</span>
            <h3>{t('about.evolution.ti.title')}</h3>
            <p>{t('about.evolution.ti.body')}</p>
            <div className="ab-outcome">{t('about.evolution.ti.outcome')}</div>
            <button type="button" className="ab-cta" onClick={() => navigate('/product/track-intelligence')}>
              {t('about.evolution.ti.cta')}
            </button>
          </div>
          <div className="ab-inst-fig">
            <div className="ab-stagebox">
              <div className="ab-grain" aria-hidden="true" />
              <svg viewBox="0 0 560 240" role="img" aria-label={t('about.evolution.ti.figureAria')}>
                <g fontSize="9.5" letterSpacing="1" fill="rgba(185,185,185,.9)">
                  <rect x="40" y="44" width="74" height="14" fill="rgba(255,255,255,.1)" />
                  <text x="46" y="55">
                    {f('intro')}
                  </text>
                  <rect x="116" y="44" width="112" height="14" fill="rgba(255,255,255,.15)" />
                  <text x="122" y="55">
                    {f('build')}
                  </text>
                  <rect x="230" y="44" width="126" height="14" fill="rgba(238,74,38,.34)" />
                  <text x="236" y="55" fill="rgba(255,255,255,.85)">
                    {f('drop')}
                  </text>
                  <rect x="358" y="44" width="82" height="14" fill="rgba(255,255,255,.12)" />
                  <text x="364" y="55">
                    {f('breakdown')}
                  </text>
                  <rect x="442" y="44" width="78" height="14" fill="rgba(255,255,255,.1)" />
                  <text x="448" y="55">
                    {f('outro')}
                  </text>
                </g>
                <path
                  d="M 40 168 C 90 164, 130 152, 176 132 C 210 118, 250 100, 286 98 C 316 98, 342 108, 358 118 C 396 142, 440 158, 520 164"
                  fill="none"
                  stroke="#EE4A26"
                  strokeWidth="2.2"
                />
                <circle cx="290" cy="98" r="3.4" fill="#EE4A26" />
                <text x="290" y="86" fontSize="10" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.9)">
                  {f('peak312')}
                </text>
                <line x1="40" y1="186" x2="520" y2="186" stroke="rgba(255,255,255,.36)" />
                <g fontSize="9.5" letterSpacing="1" fill="rgba(185,185,185,.86)">
                  <text x="40" y="202">
                    {f('time000')}
                  </text>
                  <text x="270" y="202">
                    {f('time330')}
                  </text>
                  <text x="496" y="202">
                    {f('time700')}
                  </text>
                </g>
                <text x="40" y="226" fontSize="10" letterSpacing="1" fill="rgba(185,185,185,.9)">
                  {f('energyJourney')}
                </text>
              </svg>
            </div>
          </div>
        </div>

        <div className="ab-inst">
          <div className="ab-inst-copy">
            <span className="ab-q-label">{t('about.evolution.ci.qLabel')}</span>
            <h3>{t('about.evolution.ci.title')}</h3>
            <p>{t('about.evolution.ci.body')}</p>
            <div className="ab-outcome">{t('about.evolution.ci.outcome')}</div>
            <button type="button" className="ab-cta" onClick={() => navigate('/product/catalog-intelligence')}>
              {t('about.evolution.ci.cta')}
            </button>
          </div>
          <div className="ab-inst-fig">
            <div className="ab-stagebox">
              <div className="ab-grain" aria-hidden="true" />
              <svg viewBox="0 0 560 240" role="img" aria-label={t('about.evolution.ci.figureAria')}>
                <rect x="40" y="36" width="270" height="150" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2" />
                <rect x="54" y="50" width="180" height="122" fill={url('cells')} />
                <rect x="54" y="50" width="180" height="122" fill={url('cellsMark')} />
                <circle cx="290" cy="216" r="14" fill={url('halo')} />
                <rect x="282" y="211" width="16" height="10" fill="#EE4A26" />
                <text x="272" y="220" fontSize="10" letterSpacing="1" textAnchor="end" fill="rgba(255,255,255,.9)">
                  {f('referenceQuery')}
                </text>
                <path className="ab-sig" d="M 290 208 V 186" fill="none" stroke="#EE4A26" />
                <path className="ab-sig" d="M 310 96 C 350 92, 380 90, 412 88" fill="none" stroke="#EE4A26" />
                <g fontSize="11" letterSpacing="1">
                  <g className="ab-resolve d1">
                    <rect x="420" y="72" width="112" height="20" fill="rgba(238,74,38,.12)" />
                    <text x="428" y="86" fill="#EE4A26">
                      {f('rank01')}
                    </text>
                    <text x="458" y="86" fill="rgba(255,255,255,.95)">
                      {f('cat0417')}
                    </text>
                  </g>
                  <g className="ab-resolve d2">
                    <text x="428" y="114" fill="rgba(255,255,255,.7)">
                      {f('rank02')}
                    </text>
                    <text x="458" y="114" fill="rgba(255,255,255,.88)">
                      {f('cat1121')}
                    </text>
                  </g>
                  <g className="ab-resolve d3">
                    <text x="428" y="140" fill="rgba(255,255,255,.66)">
                      {f('rank03')}
                    </text>
                    <text x="458" y="140" fill="rgba(255,255,255,.84)">
                      {f('cat0088')}
                    </text>
                  </g>
                </g>
                <text x="40" y="210" fontSize="10" letterSpacing="1.2" fill="rgba(185,185,185,.9)">
                  {f('onePartnerScope')}
                </text>
                <text x="40" y="228" fontSize="10" letterSpacing="1.2" fill="rgba(185,185,185,.9)">
                  {f('noSharedCataloguePool')}
                </text>
              </svg>
            </div>
          </div>
        </div>

        <div className="ab-api-rail ab-chamfer">
          <div>
            <span className="ab-lbl">{t('about.evolution.api.label')}</span>
            <p>{t('about.evolution.api.body')}</p>
          </div>
          <div className="ab-links">
            <button
              type="button"
              className="ab-text-link"
              style={{ color: 'var(--ab-white)' }}
              onClick={() => navigate('/developers')}
            >
              {t('about.evolution.api.cta')}
            </button>
            <span className="ab-anno">{t('about.evolution.api.anno')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
