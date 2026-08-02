import { useTranslation } from 'react-i18next';
import { useAbDefs } from './abDefs.ts';

/* S7 · Beyond trends — an older catalogue recording resolves into the ranked output. */
export function AbShelf() {
  const { t } = useTranslation('common');
  const { url } = useAbDefs();
  const f = (key: string) => t(`about.figures.${key}`);

  return (
    <section className="ab-sec ab-section" id="ab-s7">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.shelf.eyebrow')}</div>
        <h2 className="ab-h2">{t('about.shelf.h2')}</h2>
        <div className="ab-copycol">
          <p className="ab-body-p">{t('about.shelf.body1')}</p>
          <p className="ab-body-p">{t('about.shelf.body2')}</p>
        </div>
      </div>
      <div className="ab-wrap ab-bleed ab-fig">
        <div className="ab-stagebox">
          <div className="ab-grain" aria-hidden="true" />

          <svg className="ab-d-only" viewBox="0 0 1200 320" role="img" aria-label={t('about.shelf.figureAriaD')}>
            <text x="60" y="44" fontSize="10" letterSpacing="1.6" fill="rgba(185,185,185,.92)">{f('catalogueByReleaseOrder')}</text>
            <g fill="rgba(255,255,255,.14)">
              <rect x="60" y="64" width="24" height="14" /><rect x="98" y="64" width="24" height="14" /><rect x="136" y="64" width="24" height="14" /><rect x="174" y="64" width="24" height="14" /><rect x="212" y="64" width="24" height="14" /><rect x="250" y="64" width="24" height="14" />
              <rect x="60" y="92" width="24" height="14" /><rect x="136" y="92" width="24" height="14" /><rect x="174" y="92" width="24" height="14" /><rect x="250" y="92" width="24" height="14" />
              <rect x="60" y="120" width="24" height="14" /><rect x="98" y="120" width="24" height="14" /><rect x="212" y="120" width="24" height="14" /><rect x="250" y="120" width="24" height="14" />
            </g>
            <g className="ab-resolve d2">
              <rect x="98" y="92" width="24" height="14" fill="rgba(255,255,255,.85)" />
              <rect x="94" y="88" width="32" height="22" fill="none" stroke="rgba(238,74,38,.8)" />
            </g>
            <text x="60" y="160" fontSize="9.5" letterSpacing="1.2" fill="rgba(185,185,185,.92)">{f('olderCatalogueRecording2011')}</text>
            <line x1="60" y1="178" x2="286" y2="178" stroke="rgba(255,255,255,.13)" />
            <text x="60" y="196" fontSize="8.5" letterSpacing="1.2" fill="rgba(185,185,185,.4)">{f('year2009')}</text>
            <text x="286" y="196" fontSize="8.5" letterSpacing="1.2" textAnchor="end" fill="rgba(185,185,185,.4)">{f('year2026')}</text>

            <circle cx="560" cy="72" r="20" fill={url('halo')} />
            <rect x="549" y="66" width="22" height="13" fill="#EE4A26" />
            <text x="588" y="77" fontSize="10" letterSpacing="1.2" fill="rgba(255,255,255,.94)">{f('activeReference2026')}</text>
            <path className="ab-sig" d="M 552 84 C 420 110, 240 92, 128 98" fill="none" stroke="#EE4A26" />
            <text x="360" y="130" fontSize="9.5" letterSpacing="1.2" textAnchor="middle" fill="rgba(185,185,185,.92)">{f('matchedThroughSonicRelevance')}</text>

            <g>
              <rect x="700" y="120" width="420" height="150" fill="#1C1C1F" stroke="rgba(255,255,255,.34)" />
              <text x="716" y="146" fontSize="10" letterSpacing="1.4" fill="rgba(255,255,255,.92)">{f('rankedOutput')}</text>
              <g fontSize="10.5" letterSpacing="1">
                <text x="716" y="174" fill="rgba(255,255,255,.72)">{f('rank01')}</text><text x="748" y="174" fill="rgba(255,255,255,.9)">{f('cat2201_2026')}</text>
                <g className="ab-resolve d3">
                  <rect x="708" y="184" width="404" height="22" fill="rgba(238,74,38,.12)" />
                  <text x="716" y="199" fill="#EE4A26">{f('rank02')}</text><text x="748" y="199" fill="rgba(255,255,255,.95)">{f('cat0417_2011')}</text>
                  <text x="1104" y="199" textAnchor="end" fill="rgba(238,74,38,.9)">{f('score926')}</text>
                </g>
                <text x="716" y="226" fill="rgba(255,255,255,.66)">{f('rank03')}</text><text x="748" y="226" fill="rgba(255,255,255,.84)">{f('rec1c44_2023')}</text>
                <text x="716" y="252" fill="rgba(255,255,255,.62)">{f('rank04')}</text><text x="748" y="252" fill="rgba(255,255,255,.8)">{f('cat1388_2019')}</text>
              </g>
            </g>
            <path className="ab-sig" d="M 126 112 C 260 220, 480 250, 696 226" fill="none" stroke="#EE4A26" />
            <text x="60" y="300" fontSize="9" letterSpacing="1.2" fill="rgba(185,185,185,.6)">{f('recencyDidNotCreateMatch')}</text>
          </svg>

          <svg className="ab-m-only" viewBox="0 0 390 430" role="img" aria-label={t('about.shelf.figureAriaM')}>
            <text x="24" y="26" fontSize="12.3" letterSpacing="1" fill="rgba(185,185,185,.92)">{f('catalogueByReleaseOrder')}</text>
            <g fill="rgba(255,255,255,.14)">
              <rect x="24" y="40" width="22" height="13" /><rect x="58" y="40" width="22" height="13" /><rect x="126" y="40" width="22" height="13" /><rect x="160" y="40" width="22" height="13" /><rect x="194" y="40" width="22" height="13" />
            </g>
            <g className="ab-resolve d2">
              <rect x="92" y="40" width="22" height="13" fill="rgba(255,255,255,.85)" />
              <rect x="88" y="36" width="30" height="21" fill="none" stroke="rgba(238,74,38,.8)" />
            </g>
            <text x="24" y="82" fontSize="12.3" letterSpacing=".9" fill="rgba(185,185,185,.92)">{f('olderCatalogueRecording2011')}</text>
            <circle cx="330" cy="118" r="16" fill={url('halo')} />
            <rect x="320" y="112" width="20" height="12" fill="#EE4A26" />
            <text x="298" y="122" fontSize="12.3" letterSpacing=".9" textAnchor="end" fill="rgba(255,255,255,.94)">{f('activeReference2026')}</text>
            <path className="ab-sig" d="M 322 110 C 240 76, 160 60, 118 50" fill="none" stroke="#EE4A26" />
            <text x="24" y="158" fontSize="12.3" letterSpacing=".9" fill="rgba(185,185,185,.92)">{f('matchedThroughSonicRelevance')}</text>
            <path className="ab-sig" d="M 195 168 V 196" fill="none" stroke="#EE4A26" />
            <rect x="24" y="204" width="342" height="158" fill="#1C1C1F" stroke="rgba(255,255,255,.34)" />
            <text x="40" y="230" fontSize="12.3" letterSpacing="1" fill="rgba(255,255,255,.92)">{f('rankedOutput')}</text>
            <g fontSize="12.4" letterSpacing=".9">
              <text x="40" y="258" fill="rgba(255,255,255,.72)">{f('rank01')}</text><text x="74" y="258" fill="rgba(255,255,255,.9)">{f('cat2201_2026')}</text>
              <g className="ab-resolve d3">
                <rect x="32" y="270" width="326" height="24" fill="rgba(238,74,38,.12)" />
                <text x="40" y="287" fill="#EE4A26">{f('rank02')}</text><text x="74" y="287" fill="rgba(255,255,255,.95)">{f('cat0417_2011')}</text>
                <text x="350" y="287" textAnchor="end" fill="rgba(238,74,38,.9)">{f('score926')}</text>
              </g>
              <text x="40" y="320" fill="rgba(255,255,255,.66)">{f('rank03')}</text><text x="74" y="320" fill="rgba(255,255,255,.84)">{f('rec1c44_2023')}</text>
              <text x="40" y="348" fill="rgba(255,255,255,.62)">{f('rank04')}</text><text x="74" y="348" fill="rgba(255,255,255,.8)">{f('cat1388_2019')}</text>
            </g>
            <text x="24" y="398" fontSize="12.3" letterSpacing=".8" fill="rgba(185,185,185,.6)">{f('recencyDidNotCreateMatch')}</text>
          </svg>
        </div>
      </div>
    </section>
  );
}
