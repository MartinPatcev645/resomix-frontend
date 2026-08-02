import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAbDefs } from './abDefs.ts';

/* S10 · For rights holders & partners — authorised audio into a private, partner-scoped index. */
export function AbPartners() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { url } = useAbDefs();
  const f = (key: string) => t(`about.figures.${key}`);

  return (
    <section className="ab-sec ab-section" id="ab-s10">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.partners.eyebrow')}</div>
        <h2 className="ab-h2">{t('about.partners.h2')}</h2>
        <div className="ab-copycol">
          <p className="ab-body-p">{t('about.partners.body1')}</p>
          <p className="ab-body-p">{t('about.partners.body2')}</p>
          <p className="ab-body-p">{t('about.partners.body3')}</p>
        </div>
        <div className="ab-cta-row">
          <button type="button" className="ab-btn ab-primary" onClick={() => navigate('/partners/pilot')}>
            {t('about.partners.ctaPrimary')}
          </button>
          <button type="button" className="ab-btn" onClick={() => navigate('/trust')}>
            {t('about.partners.ctaSecondary')}
          </button>
        </div>
      </div>

      <div className="ab-wrap ab-bleed ab-fig">
        <div className="ab-stagebox">
          <div className="ab-grain" aria-hidden="true" />

          <svg className="ab-d-only" viewBox="0 0 1200 280" role="img" aria-label={t('about.partners.figureAriaD')}>
            <path d="M 60 100 h 190 l 12 12 v 52 h -202 z" fill="#17171A" stroke="rgba(255,255,255,.34)" />
            <text x="76" y="128" fontSize="9.5" letterSpacing="1.1" fill="rgba(255,255,255,.92)">{f('authorisedAudio')}</text>
            <text x="76" y="144" fontSize="9.5" letterSpacing="1.1" fill="rgba(255,255,255,.92)">{f('agreedMetadata')}</text>
            <path className="ab-sig" d="M 262 132 H 322" fill="none" stroke="#EE4A26" />
            <circle cx="356" cy="132" r="17" fill="none" stroke="rgba(255,255,255,.52)" strokeDasharray="66 40" transform="rotate(30 356 132)" />
            <rect x="351" y="127" width="10" height="10" fill="#0C0C0D" stroke="rgba(238,74,38,.85)" transform="rotate(45 356 132)" />
            <text x="356" y="172" fontSize="9.5" letterSpacing="1.2" textAnchor="middle" fill="rgba(255,255,255,.9)">{f('pyxisProcessing')}</text>
            <path className="ab-sig" d="M 376 132 H 436" fill="none" stroke="#EE4A26" />
            <g>
              <rect x="448" y="52" width="330" height="176" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2" />
              <text x="448" y="40" fontSize="10.5" letterSpacing="1.8" fill="rgba(255,255,255,.95)">{f('privateSonicIndex')}</text>
              <rect x="464" y="68" width="240" height="132" fill={url('cells')} />
              <rect x="464" y="68" width="240" height="132" fill={url('cellsMark')} />
              <text x="448" y="250" fontSize="9.5" letterSpacing="1.2" fill="rgba(185,185,185,.92)">{f('onePartnerScopeNoSharedCatalogue')}</text>
            </g>
            <path className="ab-sig" d="M 778 112 C 830 108, 870 106, 918 104" fill="none" stroke="#EE4A26" />
            <g>
              <rect x="930" y="72" width="220" height="60" fill="#1C1C1F" stroke="rgba(255,255,255,.34)" />
              <text x="948" y="98" fontSize="10" letterSpacing="1.2" fill="rgba(255,255,255,.94)">{f('rankedPartner')}</text>
              <text x="948" y="114" fontSize="10" letterSpacing="1.2" fill="rgba(255,255,255,.94)">{f('output')}</text>
            </g>
            <path d="M 778 176 C 840 188, 880 194, 924 198" fill="none" stroke="rgba(255,255,255,.36)" />
            <rect x="930" y="176" width="220" height="44" fill="none" stroke="rgba(255,255,255,.36)" />
            <text x="1040" y="196" fontSize="9.5" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.92)">{f('openTrackIntelligence')}</text>
            <text x="1040" y="210" fontSize="8.5" letterSpacing=".9" textAnchor="middle" fill="rgba(185,185,185,.6)">{f('separateOption')}</text>
            <text x="60" y="250" fontSize="9.5" letterSpacing="1.2" fill="rgba(185,185,185,.92)">{f('partnerKeepsControlGuidedPilot')}</text>
          </svg>

          <svg className="ab-m-only" viewBox="0 0 390 548" role="img" aria-label={t('about.partners.figureAriaM')}>
            <path d="M 24 20 h 250 l 10 10 v 40 h -260 z" fill="#17171A" stroke="rgba(255,255,255,.34)" />
            <text x="38" y="50" fontSize="12.3" letterSpacing=".9" fill="rgba(255,255,255,.92)">{f('authorisedAudioMetadataM')}</text>
            <path className="ab-sig" d="M 150 70 V 98" fill="none" stroke="#EE4A26" />
            <circle cx="150" cy="114" r="14" fill="none" stroke="rgba(255,255,255,.52)" strokeDasharray="55 33" transform="rotate(30 150 114)" />
            <rect x="146" y="110" width="8" height="8" fill="#0C0C0D" stroke="rgba(238,74,38,.85)" transform="rotate(45 150 114)" />
            <text x="176" y="119" fontSize="12.3" letterSpacing=".9" fill="rgba(255,255,255,.9)">{f('pyxisProcessing')}</text>
            <path className="ab-sig" d="M 150 130 V 158" fill="none" stroke="#EE4A26" />
            <rect x="24" y="164" width="342" height="170" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2" />
            <text x="24" y="154" fontSize="12.5" letterSpacing="1.2" fill="rgba(255,255,255,.95)">{f('privateSonicIndex')}</text>
            <rect x="40" y="180" width="220" height="120" fill={url('cells')} />
            <rect x="40" y="180" width="220" height="120" fill={url('cellsMark')} />
            <text x="40" y="322" fontSize="12.3" letterSpacing=".9" fill="rgba(185,185,185,.92)">{f('onePartnerScopeNoSharedPoolM')}</text>
            <path className="ab-sig" d="M 195 334 V 366" fill="none" stroke="#EE4A26" />
            <rect x="24" y="372" width="342" height="52" fill="#1C1C1F" stroke="rgba(255,255,255,.34)" />
            <text x="42" y="403" fontSize="12.3" letterSpacing="1" fill="rgba(255,255,255,.94)">{f('rankedPartnerOutputM')}</text>
            <path d="M 195 424 V 448" fill="none" stroke="rgba(255,255,255,.36)" />
            <rect x="24" y="454" width="342" height="48" fill="none" stroke="rgba(255,255,255,.36)" />
            <text x="42" y="474" fontSize="12.3" letterSpacing=".9" fill="rgba(185,185,185,.92)">{f('openTrackIntelligence')}</text>
            <text x="42" y="492" fontSize="12.3" letterSpacing=".8" fill="rgba(185,185,185,.6)">{f('separateOption')}</text>
            <text x="24" y="534" fontSize="12.3" letterSpacing=".9" fill="rgba(185,185,185,.92)">{f('partnerKeepsControlM')}</text>
            <text x="24" y="550" fontSize="12.3" letterSpacing=".9" fill="rgba(185,185,185,.92)">{f('guidedPilotM')}</text>
          </svg>
        </div>
      </div>
    </section>
  );
}
