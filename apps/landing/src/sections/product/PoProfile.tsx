import { useTranslation } from 'react-i18next';
import { usePoDefs } from './poDefs.ts';

/* S3 · Profile Instrument — the shared PYXIS-1 fork. */
export function PoProfile() {
  const { t } = useTranslation('common');
  const { url } = usePoDefs();
  const f = (key: string) => t(`product.figures.${key}`);

  return (
    <section className="po-sec po-section" id="po-s3">
      <div className="po-wrap">
        <div className="po-eyebrow">{t('product.profile.eyebrow')}</div>
        <h2 className="po-h2">{t('product.profile.h2')}</h2>
        <div className="po-copycol">
          <p className="po-body-p">{t('product.profile.body1')}</p>
          <p className="po-body-p">{t('product.profile.body2')}</p>
        </div>
        <div className="po-status-rail" style={{ marginTop: '1.5rem' }}>{t('product.profile.status')}</div>
      </div>

      <div className="po-wrap po-bleed po-fig">
        <div className="po-stagebox">

      <div className="po-grain" aria-hidden="true" />

      {/* ============ PROFILE INSTRUMENT · DESKTOP ============ */}
      <svg className="po-d-only" viewBox="0 0 1200 340" role="img"
           aria-label={t('product.profile.figureAriaD')}>
        <rect x="70" y="146" width="26" height="15" fill="rgba(255,255,255,.94)"/>
        <line x1="75" y1="153" x2="91" y2="153" stroke="#101010"/>
        <text x="70" y="132" fontSize="8.5" letterSpacing="1.2" fill="rgba(255,255,255,.94)">{f('oneRecording')}</text>
        <path className="po-sig" d="M 100 153 H 168" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

        {/* five signal bands */}
        <g>
          <rect x="180" y="44" width="300" height="226" fill="rgba(255,255,255,.012)" stroke="rgba(255,255,255,.1)"/>
          <g fontSize="8" letterSpacing="1.2" fill="rgba(185,185,185,.85)">
            <text x="196" y="72">{f('rhythm')}</text>
            <text x="196" y="116">{f('harmony')}</text>
            <text x="196" y="160">{f('timbre')}</text>
            <text x="196" y="204">{f('structure')}</text>
            <text x="196" y="248">{f('energy')}</text>
          </g>
          <g stroke="rgba(255,255,255,.4)" strokeWidth="1">
            <path d="M 280 68 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6 l 8 -6 l 8 6" fill="none"/>
            <path d="M 280 112 C 300 104, 320 120, 340 112 C 360 104, 380 120, 400 112 C 420 104, 440 120, 460 112" fill="none"/>
            <path d="M 280 156 C 310 148, 330 164, 360 152 C 390 142, 420 166, 460 156" fill="none" strokeDasharray="3 4"/>
            <path d="M 280 200 H 306 V 194 H 336 V 206 H 372 V 196 H 410 V 204 H 460" fill="none"/>
            <path d="M 280 246 C 320 240, 350 228, 380 224 C 410 222, 440 234, 460 242" fill="none"/>
          </g>
          <text x="330" y="292" fontSize="8.5" letterSpacing="1.5" textAnchor="middle" fill="rgba(185,185,185,.85)">{f('characteristics70')}</text>
          <rect x="252" y="280" width="156" height="17" fill="none" stroke="rgba(255,255,255,.3)"/>
        </g>

        <path className="po-sig" d="M 480 153 H 560" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

        {/* sonic profile cell */}
        <g>
          <circle cx="620" cy="153" r="44" fill="none" stroke="rgba(255,255,255,.42)"
                  strokeDasharray="172 105" transform="rotate(150 620 153)"/>
          <rect x="600" y="140" width="40" height="26" fill="#17171A" stroke="rgba(238,74,38,.8)"/>
          <line x1="608" y1="149" x2="632" y2="149" stroke="rgba(255,255,255,.6)"/>
          <line x1="608" y1="157" x2="626" y2="157" stroke="rgba(255,255,255,.5)"/>
          <text x="620" y="94" fontSize="9.5" letterSpacing="2" textAnchor="middle" fill="rgba(255,255,255,.95)">{f('sonicProfile')}</text>
        </g>

        {/* two operations */}
        <path className="po-sig" d="M 664 138 C 730 118, 790 108, 860 102" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
        <path d="M 664 168 C 730 188, 790 198, 860 204" fill="none" stroke="rgba(255,255,255,.5)"/>
        <g>
          <rect x="872" y="72" width="252" height="56" fill="#17171A" stroke="rgba(255,255,255,.3)"/>
          <text x="890" y="96" fontSize="8.5" letterSpacing="1.2" fill="rgba(185,185,185,.86)">{f('readTheRecording')}</text>
          <text x="890" y="114" fontSize="9.5" letterSpacing="1.6" fill="rgba(255,255,255,.97)">{f('trackIntelligence')}</text>
        </g>
        <g>
          <rect x="872" y="176" width="252" height="56" fill="#17171A" stroke="rgba(255,255,255,.3)"/>
          <text x="890" y="200" fontSize="8.5" letterSpacing="1.2" fill="rgba(185,185,185,.86)">{f('compareWithIndex')}</text>
          <text x="890" y="218" fontSize="9.5" letterSpacing="1.6" fill="rgba(255,255,255,.97)">{f('similarityRanking')}</text>
        </g>
        <text x="620" y="318" fontSize="7.5" letterSpacing="1.2" textAnchor="middle" fill="rgba(185,185,185,.76)">{f('twoOpsCaption')}</text>
      </svg>

      {/* ============ PROFILE INSTRUMENT · MOBILE ============ */}
      <svg className="po-m-only" viewBox="0 0 390 560" role="img"
           aria-label={t('product.profile.figureAriaM')}>
        <rect x="40" y="24" width="22" height="13" fill="rgba(255,255,255,.94)"/>
        <text x="74" y="34" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.94)">{f('oneRecording')}</text>
        <path className="po-sig" d="M 51 40 V 66" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
        <rect x="24" y="74" width="342" height="188" fill="rgba(255,255,255,.012)" stroke="rgba(255,255,255,.1)"/>
        <g fontSize="7.4" letterSpacing="1" fill="rgba(185,185,185,.85)">
          <text x="38" y="100">{f('rhythm')}</text><text x="38" y="134">{f('harmony')}</text>
          <text x="38" y="168">{f('timbre')}</text><text x="38" y="202">{f('structure')}</text><text x="38" y="236">{f('energy')}</text>
        </g>
        <g stroke="rgba(255,255,255,.4)">
          <path d="M 128 96 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5" fill="none"/>
          <path d="M 128 130 C 150 122, 170 138, 192 130 C 214 122, 236 138, 258 130 C 280 122, 302 138, 336 130" fill="none"/>
          <path d="M 128 164 C 160 156, 190 172, 224 160 C 258 150, 300 172, 336 164" fill="none" strokeDasharray="3 4"/>
          <path d="M 128 198 H 158 V 192 H 194 V 204 H 238 V 194 H 288 V 202 H 336" fill="none"/>
          <path d="M 128 232 C 170 226, 210 214, 250 210 C 290 208, 320 220, 336 228" fill="none"/>
        </g>
        <rect x="118" y="242" width="154" height="16" fill="none" stroke="rgba(255,255,255,.3)"/>
        <text x="195" y="253" fontSize="7.6" letterSpacing="1.2" textAnchor="middle" fill="rgba(185,185,185,.85)">{f('characteristics70')}</text>

        <path className="po-sig" d="M 195 262 V 292" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
        <circle cx="195" cy="330" r="36" fill="none" stroke="rgba(255,255,255,.42)" strokeDasharray="140 86" transform="rotate(150 195 330)"/>
        <rect x="177" y="319" width="36" height="22" fill="#17171A" stroke="rgba(238,74,38,.8)"/>
        <line x1="184" y1="327" x2="206" y2="327" stroke="rgba(255,255,255,.6)"/>
        <line x1="184" y1="334" x2="200" y2="334" stroke="rgba(255,255,255,.5)"/>
        <text x="195" y="282" fontSize="0" fill="none"> </text>
        <text x="250" y="326" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.95)">{f('sonic')}</text>
        <text x="250" y="340" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.95)">{f('profile')}</text>

        <path className="po-sig" d="M 172 358 C 140 386, 120 400, 108 414" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
        <path d="M 218 358 C 250 386, 270 400, 282 414" fill="none" stroke="rgba(255,255,255,.5)"/>
        <rect x="24" y="422" width="166" height="52" fill="#17171A" stroke="rgba(255,255,255,.3)"/>
        <text x="38" y="444" fontSize="7" letterSpacing=".9" fill="rgba(185,185,185,.86)">{f('readTheRecording')}</text>
        <text x="38" y="460" fontSize="8.2" letterSpacing="1.1" fill="rgba(255,255,255,.97)">{f('trackIntelligence')}</text>
        <rect x="200" y="422" width="166" height="52" fill="#17171A" stroke="rgba(255,255,255,.3)"/>
        <text x="214" y="444" fontSize="7" letterSpacing=".9" fill="rgba(185,185,185,.86)">{f('compareWithIndex')}</text>
        <text x="214" y="460" fontSize="8.2" letterSpacing="1.1" fill="rgba(255,255,255,.97)">{f('similarityRanking')}</text>
        <text x="195" y="516" fontSize="6.8" letterSpacing=".9" textAnchor="middle" fill="rgba(185,185,185,.76)">{f('twoOpsCaptionM1')}</text>
        <text x="195" y="530" fontSize="6.8" letterSpacing=".9" textAnchor="middle" fill="rgba(185,185,185,.76)">{f('twoOpsCaptionM2')}</text>
      </svg>
    
        </div>
      </div>
    </section>
  );
}
