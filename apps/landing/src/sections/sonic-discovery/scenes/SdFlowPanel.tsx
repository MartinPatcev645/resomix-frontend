import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useSceneLive } from './useSceneLive.ts';

interface SdFlowPanelProps {
  motionOn: boolean;
}

const PLAYLIST = [
  { rk: '01', t: 'r1t', a: 'r1a', s: 'r1s', top: true },
  { rk: '02', t: 'r2t', a: 'r2a', s: 'r2s' },
  { rk: '03', t: 'r3t', a: 'r3a', s: 'r3s' },
  { rk: '04', t: 'r4t', a: 'r4a', s: 'r4s' },
  { rk: '05', t: 'r5t', a: 'r5a', s: 'r5s' },
] as const;

export function SdFlowPanel({ motionOn }: SdFlowPanelProps) {
  const { t } = useTranslation('common');
  const uid = useId().replace(/:/g, '');
  const bandRef = useSceneLive(motionOn, false);
  const closestRanked = t('sonicDiscovery.flow.closestRanked');
  const closestRankedParts = closestRanked.match(/^(.*?)\s+(ranked\s+automatically)$/i);

  return (
    <div className="sd-scene-band sd-flow" ref={bandRef}>
      <div className="sd-flow-panel">
        <div className="sd-scene-grain" aria-hidden="true" />
        <div className="sd-flow-hd">
          <span className="sd-flow-hd-l uppercase">{t('sonicDiscovery.console.head')}</span>
          <span className="sd-flow-chip uppercase">{t('sonicDiscovery.console.truth')}</span>
        </div>

        <div className="sd-flow-body">
          <div className="sd-flow-svg">
            <svg className="sd-f-desktop" viewBox="0 0 860 620" role="img"
               aria-label={t('sonicDiscovery.flow.figureAlt')}>
            <defs>
              <radialGradient id={uid + '-halo2'} cx=".5" cy=".5" r=".5">
                <stop offset="0" stopColor="rgba(238,74,38,.3)"/>
                <stop offset="1" stopColor="rgba(238,74,38,0)"/>
              </radialGradient>
              <circle id={uid + '-fd-s'} r="1.6" fill="rgba(246,244,239,1)"/>
              <circle id={uid + '-fd-m'} r="2.4" fill="rgba(246,244,239,1)"/>
            </defs>

            
            <text x="18" y="26" fontSize="9" letterSpacing="2.5" fill="rgba(246,244,239,.6)"><tspan fill="#EE4A26">01</tspan>{'  '}{t('sonicDiscovery.flow.stage01')}</text>

            <path d="M 26 44 h 132 l 10 10 v 44 h -142 z" fill="#101012" stroke="rgba(246,244,239,.14)"/>
            <text x="36" y="76" fontSize="8.5" letterSpacing="1.6" fill="rgba(246,244,239,.85)">{t('sonicDiscovery.flow.searchTrack')}</text>
            <text x="26" y="114" fontSize="8" letterSpacing=".8" fill="rgba(246,244,239,.55)">{t('sonicDiscovery.flow.existingProfile')}</text>

            <path d="M 26 132 h 132 l 10 10 v 44 h -142 z" fill="#101012" stroke="rgba(246,244,239,.14)"/>
            <text x="36" y="164" fontSize="8.5" letterSpacing="1.6" fill="rgba(246,244,239,.85)">{t('sonicDiscovery.flow.uploadRef')}</text>
            <text x="26" y="202" fontSize="8" letterSpacing=".8" fill="rgba(246,244,239,.55)">{t('sonicDiscovery.flow.profileOnArrival')}</text>

            
            <path d="M 168 70 C 212 76, 234 96, 250 110" fill="none" stroke="rgba(238,74,38,.7)" strokeWidth="1"/>
            <path d="M 168 158 C 212 150, 234 128, 250 117" fill="none" stroke="rgba(238,74,38,.7)" strokeWidth="1" strokeDasharray="3 4"/>
            <circle cx="224" cy="140" r="3.5" fill="none" stroke="rgba(238,74,38,.6)"/>

            
            <circle cx="264" cy="113" r="24" fill={'url(#' + uid + '-halo2)'}/>
            <circle cx="264" cy="113" r="10" fill="none" stroke="rgba(238,74,38,.5)"/>
            <circle cx="264" cy="113" r="4" fill="#EE4A26"/>
            <text x="264" y="76" fontSize="9" letterSpacing="2" textAnchor="middle" fill="rgba(246,244,239,.88)">{t('sonicDiscovery.flow.oneReference')}</text>

            <path className="sig" d="M 276 113 H 356" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

            
            <text x="360" y="26" fontSize="9" letterSpacing="2.5" fill="rgba(246,244,239,.6)"><tspan fill="#EE4A26">02</tspan>{'  '}{t('sonicDiscovery.flow.stage02')}</text>

            <circle cx="432" cy="118" r="62" fill="none" stroke="rgba(246,244,239,.14)"
                    strokeDasharray="240 150" transform="rotate(159 432 118)"/>
            <circle cx="432" cy="118" r="4" fill="#EE4A26"/>
            <circle cx="432" cy="118" r="9" fill="none" stroke="rgba(238,74,38,.4)"/>
            <g strokeWidth="1">
              <line x1="432" y1="118" x2="400" y2="62"  stroke="rgba(246,244,239,.34)"/>
              <line x1="432" y1="118" x2="488" y2="74"  stroke="rgba(246,244,239,.26)"/>
              <line x1="432" y1="118" x2="494" y2="158" stroke="rgba(246,244,239,.3)"/>
              <line x1="432" y1="118" x2="394" y2="170" stroke="rgba(246,244,239,.22)"/>
              <line x1="432" y1="118" x2="370" y2="100" stroke="rgba(246,244,239,.3)"/>
            </g>
            <circle cx="400" cy="62"  r="2.6" fill="rgba(246,244,239,.85)"/>
            <circle cx="488" cy="74"  r="2.2" fill="rgba(246,244,239,.7)"/>
            <circle cx="494" cy="158" r="2.6" fill="rgba(246,244,239,.8)"/>
            <circle cx="394" cy="170" r="2.2" fill="rgba(246,244,239,.65)"/>
            <circle cx="370" cy="100" r="2.6" fill="rgba(246,244,239,.8)"/>
            <text x="400" y="50"  fontSize="7.5" letterSpacing="1.5" textAnchor="middle" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.flow.rhythm')}</text>
            <text x="502" y="70"  fontSize="7.5" letterSpacing="1.5" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.flow.harmony')}</text>
            <text x="507" y="164" fontSize="7.5" letterSpacing="1.5" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.flow.timbre')}</text>
            <text x="394" y="188" fontSize="7.5" letterSpacing="1.5" textAnchor="middle" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.flow.structure')}</text>
            <text x="356" y="92"  fontSize="7.5" letterSpacing="1.5" textAnchor="end" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.flow.energy')}</text>
            <rect x="383" y="210" width="98" height="18" fill="none" stroke="rgba(246,244,239,.14)"/>
            <text x="432" y="222" fontSize="7.5" letterSpacing="1.5" textAnchor="middle" fill="rgba(246,244,239,.55)">{t('sonicDiscovery.flow.characteristics')}</text>

            <path className="sig" d="M 496 118 H 576" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

            
            <text x="580" y="26" fontSize="9" letterSpacing="2.5" fill="rgba(246,244,239,.6)"><tspan fill="#EE4A26">03</tspan>{'  '}{t('sonicDiscovery.scene.pyxis1')}</text>
            <text x="598" y="40" fontSize="7.5" letterSpacing="1.2" fill="rgba(246,244,239,.35)">{t('sonicDiscovery.flow.comparison')}</text>

            <g>
              <line x1="614" y1="70" x2="614" y2="98" stroke="rgba(246,244,239,.3)"/>
              <line x1="614" y1="138" x2="614" y2="166" stroke="rgba(246,244,239,.3)"/>
              <line x1="566" y1="118" x2="594" y2="118" stroke="rgba(246,244,239,.3)"/>
              <line x1="634" y1="118" x2="662" y2="118" stroke="rgba(246,244,239,.3)"/>
              <circle cx="614" cy="118" r="17" fill="none" stroke="rgba(246,244,239,.4)"
                      strokeDasharray="70 37" transform="rotate(30 614 118)"/>
              <circle cx="614" cy="118" r="26" fill="none" stroke="rgba(246,244,239,.14)"
                      strokeDasharray="40 124" transform="rotate(-80 614 118)"/>
              <rect x="607" y="111" width="14" height="14" fill="#101012"
                    stroke="rgba(238,74,38,.8)" transform="rotate(45 614 118)"/>
            </g>
            <text x="632" y="196" fontSize="8" letterSpacing="1.8" fill="rgba(246,244,239,.6)">{t('sonicDiscovery.flow.pyxisComparison')}</text>

            
            <path className="sig" d="M 614 144 V 296 C 614 330, 596 352, 570 370 C 540 390, 560 412, 596 416
                     C 640 420, 668 400, 686 366 C 696 344, 698 330, 700 318 L 782 318"
                  fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

            
            <path d="M 446 312 C 486 288, 592 282, 656 296 C 706 307, 722 356, 706 402
                     C 690 448, 590 464, 512 454 C 452 446, 420 360, 446 312 Z"
                  fill="rgba(255,255,255,.014)" stroke="rgba(246,244,239,.26)"
                  strokeDasharray="2 7"/>
            <path d="M 416 294 V 278 H 432" fill="none" stroke="rgba(246,244,239,.3)"/>
            <path d="M 704 278 H 720 V 294" fill="none" stroke="rgba(246,244,239,.3)"/>
            <path d="M 416 458 V 474 H 432" fill="none" stroke="rgba(246,244,239,.3)"/>
            <path d="M 704 474 H 720 V 458" fill="none" stroke="rgba(246,244,239,.3)"/>
            <text x="120" y="344" fontSize="11.5" letterSpacing="2.5" fill="rgba(246,244,239,.85)">{t('sonicDiscovery.flow.preAnalysedIndex')}</text>
            <text x="120" y="362" fontSize="8.5" letterSpacing="1.2" fill="rgba(246,244,239,.55)">{t('sonicDiscovery.flow.catalogueCandidates')}</text>
            <line x1="348" y1="356" x2="434" y2="368" stroke="rgba(246,244,239,.16)" strokeDasharray="2 5"/>

            <path d="M 470 420 C 530 396, 610 392, 668 408" fill="none" stroke="rgba(246,244,239,.05)"/>

            <use href={'#' + uid + '-fd-s'} x="486" y="322" opacity=".24"/><use href={'#' + uid + '-fd-m'} x="530" y="308" opacity=".28"/>
            <use href={'#' + uid + '-fd-s'} x="576" y="320" opacity=".22"/><use href={'#' + uid + '-fd-s'} x="618" y="308" opacity=".26"/>
            <use href={'#' + uid + '-fd-m'} x="486" y="366" opacity=".24"/><use href={'#' + uid + '-fd-s'} x="540" y="352" opacity=".3"/>
            <use href={'#' + uid + '-fd-s'} x="592" y="360" opacity=".22"/><use href={'#' + uid + '-fd-m'} x="646" y="352" opacity=".26"/>
            <use href={'#' + uid + '-fd-s'} x="470" y="408" opacity=".22"/><use href={'#' + uid + '-fd-s'} x="524" y="404" opacity=".26"/>
            <use href={'#' + uid + '-fd-m'} x="578" y="412" opacity=".22"/><use href={'#' + uid + '-fd-s'} x="628" y="404" opacity=".24"/>
            <use href={'#' + uid + '-fd-s'} x="506" y="438" opacity=".2"/> <use href={'#' + uid + '-fd-s'} x="568" y="442" opacity=".24"/>
            <use href={'#' + uid + '-fd-s'} x="636" y="436" opacity=".2"/> <use href={'#' + uid + '-fd-s'} x="678" y="376" opacity=".26"/>

            
            <text x="744" y="26" fontSize="9" letterSpacing="2.5" fill="rgba(246,244,239,.6)"><tspan fill="#EE4A26">04</tspan>{'  '}{t('sonicDiscovery.flow.ranked')}</text>
            <text x="762" y="40" fontSize="7.5" letterSpacing="1.2" fill="rgba(246,244,239,.35)">{t('sonicDiscovery.flow.automatically')}</text>

            <text x="852" y="256" fontSize="9.5" letterSpacing="1.6" textAnchor="end" fill="rgba(246,244,239,.8)">
              <tspan x="852" dy="0">{closestRankedParts ? closestRankedParts[1] : closestRanked}</tspan>
              {closestRankedParts ? <tspan x="852" dy="15">{closestRankedParts[2]}</tspan> : null}
            </text>
            <text x="852" y="293" fontSize="8.5" letterSpacing="1.4" textAnchor="end" fill="rgba(246,244,239,.55)">{t('sonicDiscovery.flow.noManual')}</text>

            
            <g className="resolve d1">
              <circle cx="700" cy="318" r="10" fill={'url(#' + uid + '-halo2)'}/>
              <circle cx="700" cy="318" r="3.6" fill="#EE4A26"/>
              <circle cx="790" cy="318" r="4.2" fill="#EE4A26"/>
              <circle cx="790" cy="318" r="8.5" fill="none" stroke="rgba(238,74,38,.45)"/>
              <text x="806" y="322" fontSize="9" letterSpacing="1.5" fill="#EE4A26">01</text>
            </g>
            <g className="resolve d2">
              <circle cx="694" cy="352" r="2.6" fill="rgba(246,244,239,.7)"/>
              <line x1="700" y1="352" x2="782" y2="352" stroke="rgba(246,244,239,.24)"/>
              <circle cx="790" cy="352" r="3.4" fill="rgba(246,244,239,.9)"/>
              <text x="806" y="356" fontSize="9" letterSpacing="1.5" fill="rgba(246,244,239,.62)">02</text>
            </g>
            <g className="resolve d3">
              <circle cx="690" cy="386" r="2.6" fill="rgba(246,244,239,.62)"/>
              <line x1="696" y1="386" x2="782" y2="386" stroke="rgba(246,244,239,.2)"/>
              <circle cx="790" cy="386" r="3.4" fill="rgba(246,244,239,.82)"/>
              <text x="806" y="390" fontSize="9" letterSpacing="1.5" fill="rgba(246,244,239,.58)">03</text>
            </g>
            <g className="resolve d4">
              <circle cx="684" cy="420" r="2.6" fill="rgba(246,244,239,.56)"/>
              <line x1="690" y1="420" x2="782" y2="420" stroke="rgba(246,244,239,.17)"/>
              <circle cx="790" cy="420" r="3.4" fill="rgba(246,244,239,.74)"/>
              <text x="806" y="424" fontSize="9" letterSpacing="1.5" fill="rgba(246,244,239,.54)">04</text>
            </g>
            <g className="resolve d5">
              <circle cx="676" cy="454" r="2.6" fill="rgba(246,244,239,.5)"/>
              <line x1="682" y1="454" x2="782" y2="454" stroke="rgba(246,244,239,.14)"/>
              <circle cx="790" cy="454" r="3.4" fill="rgba(246,244,239,.66)"/>
              <text x="806" y="458" fontSize="9" letterSpacing="1.5" fill="rgba(246,244,239,.5)">05</text>
            </g>
            <line x1="790" y1="326" x2="790" y2="450" stroke="rgba(246,244,239,.14)"/>

            
            <path d="M 110 540 C 220 500, 330 500, 430 540" fill="none" stroke="rgba(246,244,239,.05)"/>
            <use href={'#' + uid + '-fd-s'} x="150" y="470" opacity=".16"/>
            <use href={'#' + uid + '-fd-s'} x="256" y="500" opacity=".14"/>
            <use href={'#' + uid + '-fd-s'} x="360" y="482" opacity=".16"/>

            <g stroke="rgba(246,244,239,.06)">
              <line x1="26" y1="600" x2="852" y2="600"/>
              <line x1="200" y1="596" x2="200" y2="604"/><line x1="400" y1="596" x2="400" y2="604"/>
              <line x1="600" y1="596" x2="600" y2="604"/><line x1="800" y1="596" x2="800" y2="604"/>
            </g>
            <text x="26" y="616" fontSize="7" letterSpacing="1.5" fill="rgba(246,244,239,.25)">{t('sonicDiscovery.flow.spaceSchematic')}</text>
          </svg>
            <svg className="sd-f-mobile" viewBox="0 0 390 904" role="img"
               aria-label={t('sonicDiscovery.flow.figureAltMobile')}>
            <defs>
              <radialGradient id={uid + '-halo3'} cx=".5" cy=".5" r=".5">
                <stop offset="0" stopColor="rgba(238,74,38,.3)"/>
                <stop offset="1" stopColor="rgba(238,74,38,0)"/>
              </radialGradient>
              <circle id={uid + '-md-s'} r="1.5" fill="rgba(246,244,239,1)"/>
            </defs>

            <text x="20" y="24" fontSize="9" letterSpacing="2" fill="rgba(246,244,239,.6)"><tspan fill="#EE4A26">01</tspan>{'  '}{t('sonicDiscovery.flow.stage01')}</text>

            <path d="M 20 40 h 342 l 8 8 v 40 h -350 z" fill="#101012" stroke="rgba(246,244,239,.14)"/>
            <text x="32" y="68" fontSize="8" letterSpacing="1.4" fill="rgba(246,244,239,.85)">{t('sonicDiscovery.flow.searchTrack')}</text>
            <text x="360" y="68" fontSize="7.6" letterSpacing=".8" textAnchor="end" fill="rgba(246,244,239,.55)">{t('sonicDiscovery.flow.existingProfile')}</text>

            <text x="195" y="106" fontSize="7" letterSpacing="2" textAnchor="middle" fill="rgba(246,244,239,.35)">{t('sonicDiscovery.flow.or')}</text>

            <path d="M 20 118 h 342 l 8 8 v 40 h -350 z" fill="#101012" stroke="rgba(246,244,239,.14)"/>
            <text x="32" y="146" fontSize="8" letterSpacing="1.4" fill="rgba(246,244,239,.85)">{t('sonicDiscovery.flow.uploadRef')}</text>
            <text x="360" y="146" fontSize="7.6" letterSpacing=".8" textAnchor="end" fill="rgba(246,244,239,.55)">{t('sonicDiscovery.flow.profileOnArrival')}</text>

            <path className="sig" d="M 195 166 V 196" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

            <circle cx="195" cy="212" r="18" fill={'url(#' + uid + '-halo3)'}/>
            <circle cx="195" cy="212" r="8.5" fill="none" stroke="rgba(238,74,38,.5)"/>
            <circle cx="195" cy="212" r="3.6" fill="#EE4A26"/>
            <text x="195" y="248" fontSize="8.5" letterSpacing="1.8" textAnchor="middle" fill="rgba(246,244,239,.88)">{t('sonicDiscovery.flow.oneReference')}</text>

            <path className="sig" d="M 195 256 V 292" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

            <text x="20" y="286" fontSize="9" letterSpacing="2" fill="rgba(246,244,239,.6)"><tspan fill="#EE4A26">02</tspan>{'  '}{t('sonicDiscovery.flow.stage02')}</text>

            <circle cx="195" cy="352" r="50" fill="none" stroke="rgba(246,244,239,.14)"
                    strokeDasharray="194 120" transform="rotate(159 195 352)"/>
            <circle cx="195" cy="352" r="3.6" fill="#EE4A26"/>
            <g strokeWidth="1">
              <line x1="195" y1="352" x2="168" y2="310" stroke="rgba(246,244,239,.32)"/>
              <line x1="195" y1="352" x2="238" y2="320" stroke="rgba(246,244,239,.26)"/>
              <line x1="195" y1="352" x2="242" y2="382" stroke="rgba(246,244,239,.3)"/>
              <line x1="195" y1="352" x2="166" y2="392" stroke="rgba(246,244,239,.22)"/>
              <line x1="195" y1="352" x2="144" y2="348" stroke="rgba(246,244,239,.3)"/>
            </g>
            <circle cx="168" cy="310" r="2.4" fill="rgba(246,244,239,.85)"/>
            <circle cx="238" cy="320" r="2.2" fill="rgba(246,244,239,.7)"/>
            <circle cx="242" cy="382" r="2.4" fill="rgba(246,244,239,.8)"/>
            <circle cx="166" cy="392" r="2.2" fill="rgba(246,244,239,.65)"/>
            <circle cx="144" cy="348" r="2.4" fill="rgba(246,244,239,.8)"/>
            <text x="164" y="298" fontSize="7" letterSpacing="1.2" textAnchor="middle" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.flow.rhythm')}</text>
            <text x="250" y="316" fontSize="7" letterSpacing="1.2" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.flow.harmony')}</text>
            <text x="252" y="388" fontSize="7" letterSpacing="1.2" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.flow.timbre')}</text>
            <text x="166" y="408" fontSize="7" letterSpacing="1.2" textAnchor="middle" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.flow.structure')}</text>
            <text x="132" y="340" fontSize="7" letterSpacing="1.2" textAnchor="end" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.flow.energy')}</text>
            <rect x="146" y="424" width="98" height="17" fill="none" stroke="rgba(246,244,239,.14)"/>
            <text x="195" y="436" fontSize="7" letterSpacing="1.2" textAnchor="middle" fill="rgba(246,244,239,.55)">{t('sonicDiscovery.flow.characteristics')}</text>

            <path className="sig" d="M 195 440 V 476" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

            <text x="20" y="470" fontSize="9" letterSpacing="2" fill="rgba(246,244,239,.6)"><tspan fill="#EE4A26">03</tspan>{'  '}{t('sonicDiscovery.flow.pyxisComparison')}</text>

            <g>
              <line x1="195" y1="480" x2="195" y2="492" stroke="rgba(246,244,239,.3)"/>
              <line x1="195" y1="522" x2="195" y2="534" stroke="rgba(246,244,239,.3)"/>
              <line x1="158" y1="507" x2="170" y2="507" stroke="rgba(246,244,239,.3)"/>
              <line x1="220" y1="507" x2="232" y2="507" stroke="rgba(246,244,239,.3)"/>
              <circle cx="195" cy="507" r="14" fill="none" stroke="rgba(246,244,239,.4)"
                      strokeDasharray="56 32" transform="rotate(30 195 507)"/>
              <rect x="189" y="501" width="12" height="12" fill="#101012"
                    stroke="rgba(238,74,38,.8)" transform="rotate(45 195 507)"/>
            </g>

            <path className="sig" d="M 195 526 V 560" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

            
            <path d="M 78 580 C 118 562, 268 560, 310 582 C 338 597, 338 652, 310 674
                     C 270 696, 124 694, 90 674 C 64 658, 56 604, 78 580 Z"
                  fill="rgba(255,255,255,.014)" stroke="rgba(246,244,239,.26)" strokeDasharray="2 6"/>
            <path d="M 52 568 V 556 H 66" fill="none" stroke="rgba(246,244,239,.3)"/>
            <path d="M 324 556 H 338 V 568" fill="none" stroke="rgba(246,244,239,.3)"/>
            <path d="M 52 688 V 700 H 66" fill="none" stroke="rgba(246,244,239,.3)"/>
            <path d="M 324 700 H 338 V 688" fill="none" stroke="rgba(246,244,239,.3)"/>
            <use href={'#' + uid + '-md-s'} x="118" y="600" opacity=".26"/><use href={'#' + uid + '-md-s'} x="162" y="588" opacity=".22"/>
            <use href={'#' + uid + '-md-s'} x="228" y="596" opacity=".26"/><use href={'#' + uid + '-md-s'} x="276" y="606" opacity=".22"/>
            <use href={'#' + uid + '-md-s'} x="120" y="644" opacity=".2"/> <use href={'#' + uid + '-md-s'} x="176" y="652" opacity=".26"/>
            <use href={'#' + uid + '-md-s'} x="238" y="646" opacity=".22"/><use href={'#' + uid + '-md-s'} x="284" y="652" opacity=".2"/>
            <use href={'#' + uid + '-md-s'} x="150" y="622" opacity=".22"/><use href={'#' + uid + '-md-s'} x="256" y="624" opacity=".24"/>
            <path className="sig" d="M 195 560 V 700" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
            <path className="sig" d="M 195 700 C 195 744, 190 776, 184 794" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
            <text x="20" y="722" fontSize="10.5" letterSpacing="2" fill="rgba(246,244,239,.85)">{t('sonicDiscovery.flow.preAnalysedIndex')}</text>
            <text x="20" y="738" fontSize="7.8" letterSpacing=".9" fill="rgba(246,244,239,.55)">{t('sonicDiscovery.flow.catalogueCandidates')}</text>

            <text x="20" y="762" fontSize="9" letterSpacing="2" fill="rgba(246,244,239,.7)"><tspan fill="#EE4A26">04</tspan>{'  '}{t('sonicDiscovery.flow.closestRanked')}</text>
            <text x="38" y="776" fontSize="8" letterSpacing="1.2" fill="rgba(246,244,239,.55)">{t('sonicDiscovery.flow.noManual')}</text>

            <line x1="160" y1="786" x2="160" y2="884" stroke="rgba(246,244,239,.18)"/>
            <g className="resolve d1">
              <line x1="160" y1="794" x2="176" y2="794" stroke="rgba(238,74,38,.8)" strokeWidth="1.2"/>
              <circle cx="184" cy="794" r="9" fill={'url(#' + uid + '-halo3)'}/>
              <circle cx="184" cy="794" r="3.8" fill="#EE4A26"/>
              <text x="200" y="798" fontSize="8.5" letterSpacing="1.4" fill="#EE4A26">01</text>
            </g>
            <g className="resolve d2">
              <line x1="160" y1="816" x2="179" y2="816" stroke="rgba(246,244,239,.24)"/>
              <circle cx="184" cy="816" r="3" fill="rgba(246,244,239,.9)"/>
              <text x="200" y="820" fontSize="8.5" letterSpacing="1.4" fill="rgba(246,244,239,.62)">02</text>
            </g>
            <g className="resolve d3">
              <line x1="160" y1="838" x2="179" y2="838" stroke="rgba(246,244,239,.2)"/>
              <circle cx="184" cy="838" r="3" fill="rgba(246,244,239,.82)"/>
              <text x="200" y="842" fontSize="8.5" letterSpacing="1.4" fill="rgba(246,244,239,.58)">03</text>
            </g>
            <g className="resolve d4">
              <line x1="160" y1="860" x2="179" y2="860" stroke="rgba(246,244,239,.17)"/>
              <circle cx="184" cy="860" r="3" fill="rgba(246,244,239,.74)"/>
              <text x="200" y="864" fontSize="8.5" letterSpacing="1.4" fill="rgba(246,244,239,.54)">04</text>
            </g>
            <g className="resolve d5">
              <line x1="160" y1="882" x2="179" y2="882" stroke="rgba(246,244,239,.14)"/>
              <circle cx="184" cy="882" r="3" fill="rgba(246,244,239,.66)"/>
              <text x="200" y="886" fontSize="8.5" letterSpacing="1.4" fill="rgba(246,244,239,.5)">05</text>
            </g>
          </svg>
          </div>

          <aside className="sd-pl-col">
            <span className="sd-stage-tag uppercase">
              <span className="sd-stage-n">05</span>
              {t('sonicDiscovery.flow.stage05')}
            </span>
            <div className="sd-pl-card sd-chamfer-14">
              <div className="sd-pl-hd">
                <span className="sd-pl-hd-t uppercase">{t('sonicDiscovery.scene.playlistTitle')}</span>
                <span className="sd-pl-chip uppercase">{t('sonicDiscovery.flow.sampleData')}</span>
              </div>
              {PLAYLIST.map((row, i) => (
                <div
                  key={row.rk}
                  className={`sd-pl-row resolve d${i + 1}${'top' in row && row.top ? ' top' : ''}`}
                >
                  <span className="sd-pl-rk">{row.rk}</span>
                  <span>
                    <span className="sd-pl-ti">{t(`sonicDiscovery.flow.${row.t}`)}</span>
                    <span className="sd-pl-ar">{t(`sonicDiscovery.flow.${row.a}`)}</span>
                  </span>
                  <span className="sd-pl-sc">{t(`sonicDiscovery.flow.${row.s}`)}</span>
                </div>
              ))}
              <div className="sd-pl-ft uppercase">
                <b>{t('sonicDiscovery.flow.returnedLead')}</b>
                {t('sonicDiscovery.flow.returnedRest')}
              </div>
            </div>
          </aside>
        </div>

        <div className="sd-flow-ft">
          <span className="sd-flow-ft-t uppercase">{t('sonicDiscovery.console.foot')}</span>
          <span className="sd-flow-chip uppercase">{t('sonicDiscovery.flow.sampleData')}</span>
        </div>
      </div>
    </div>
  );
}
