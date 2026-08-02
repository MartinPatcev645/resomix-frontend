import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useSceneLive } from './useSceneLive.ts';

interface SdScene1FigureProps {
  motionOn: boolean;
}

export function SdScene1Figure({ motionOn }: SdScene1FigureProps) {
  const { t } = useTranslation('common');
  const uid = useId().replace(/:/g, '');
  const bandRef = useSceneLive(motionOn, true);

  return (
    <div className="sd-scene-band sd-scene1" ref={bandRef}>
      <div className="sd-fig-head">
        <span className="sd-fig-rule" aria-hidden="true" />
        <span className="sd-fig-t uppercase">{t('sonicDiscovery.hero.fieldLabel')}</span>
      </div>

      <div className="sd-stagebox">
        <div className="sd-scene-grain" aria-hidden="true" />
        <svg className="sd-s1-desktop" viewBox="0 0 1200 520" role="img"
           aria-label={t('sonicDiscovery.scene.figureAlt')}>
        <defs>
          <linearGradient id={uid + '-shaft'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(246,244,239,.06)"/>
            <stop offset="1" stopColor="rgba(246,244,239,0)"/>
          </linearGradient>
          <radialGradient id={uid + '-halo1'} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="rgba(238,74,38,.32)"/>
            <stop offset=".55" stopColor="rgba(238,74,38,.08)"/>
            <stop offset="1" stopColor="rgba(238,74,38,0)"/>
          </radialGradient>
          <radialGradient id={uid + '-fog1'} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="rgba(210,120,62,.09)"/>
            <stop offset="1" stopColor="rgba(210,120,62,0)"/>
          </radialGradient>
          <circle id={uid + '-dt-s'} r="1.5" fill="rgba(246,244,239,1)"/>
          <circle id={uid + '-dt-m'} r="2.3" fill="rgba(246,244,239,1)"/>
        </defs>

        
        <ellipse cx="920" cy="430" rx="360" ry="150" fill={'url(#' + uid + '-fog1)'}/>
        <ellipse cx="180" cy="470" rx="260" ry="110" fill={'url(#' + uid + '-fog1)'} opacity=".6"/>
        <polygon points="520,0 690,0 642,300 612,300" fill={'url(#' + uid + '-shaft)'} opacity=".45"/>

        <g stroke="rgba(246,244,239,.07)" strokeWidth="1">
          <line x1="40" y1="486" x2="1160" y2="486"/>
          <g>
            <line x1="120" y1="482" x2="120" y2="490"/><line x1="280" y1="482" x2="280" y2="490"/>
            <line x1="440" y1="482" x2="440" y2="490"/><line x1="600" y1="482" x2="600" y2="490"/>
            <line x1="760" y1="482" x2="760" y2="490"/><line x1="920" y1="482" x2="920" y2="490"/>
            <line x1="1080" y1="482" x2="1080" y2="490"/>
          </g>
        </g>
        <text x="40" y="504" fontSize="8" letterSpacing="2" fill="rgba(246,244,239,.28)">{t('sonicDiscovery.scene.ra')}</text>
        <text x="1160" y="504" fontSize="8" letterSpacing="2" textAnchor="end" fill="rgba(246,244,239,.28)">{t('sonicDiscovery.scene.dec')}</text>

        
        <circle cx="600" cy="250" r="300" fill="none" stroke="rgba(246,244,239,.045)" strokeWidth="1"
                strokeDasharray="520 1400" transform="rotate(160 600 250)"/>
        <circle cx="600" cy="250" r="382" fill="none" stroke="rgba(246,244,239,.03)" strokeWidth="1"
                strokeDasharray="300 2100" transform="rotate(-15 600 250)"/>

        
        <g className="plx" data-plx="0.35">
          <polygon points="70,96 300,80 306,150 76,168" fill="#0D0D0F" stroke="rgba(246,244,239,.05)"/>
          <line x1="70" y1="96" x2="300" y2="80" stroke="rgba(246,244,239,.16)" strokeWidth="1"/>
          <polygon points="1010,52 1150,70 1144,104 1006,88" fill="#0C0C0E" stroke="rgba(246,244,239,.045)"/>
          <polygon points="236,404 376,392 382,430 242,444" fill="#0D0D0F" stroke="rgba(246,244,239,.05)"/>
          <line x1="236" y1="404" x2="376" y2="392" stroke="rgba(246,244,239,.12)" strokeWidth="1"/>
        </g>

        
        <g className="plx" data-plx="0.28">
          <use href={'#' + uid + '-dt-s'} x="130" y="330" opacity=".2"/>
          <use href={'#' + uid + '-dt-s'} x="352" y="120" opacity=".18"/>
          <use href={'#' + uid + '-dt-m'} x="860" y="96"  opacity=".24" className="breathe"/>
          <use href={'#' + uid + '-dt-s'} x="936" y="404" opacity=".2"/>
          <use href={'#' + uid + '-dt-s'} x="80"  y="220" opacity=".16"/>
          <use href={'#' + uid + '-dt-m'} x="452" y="430" opacity=".2"/>
        </g>

        
        <g className="plx" data-plx="0">
          <circle cx="170" cy="250" r="34" fill={'url(#' + uid + '-halo1)'}/>
          <circle cx="170" cy="250" r="26" fill="none" stroke="rgba(238,74,38,.22)" strokeWidth="1"
                  strokeDasharray="88 76" transform="rotate(140 170 250)"/>
          <circle cx="170" cy="250" r="11" fill="none" stroke="rgba(238,74,38,.55)" strokeWidth="1"/>
          <circle cx="170" cy="250" r="4.5" fill="#EE4A26"/>
          <text x="170" y="202" fontSize="10" letterSpacing="3" textAnchor="middle" fill="rgba(246,244,239,.95)">{t('sonicDiscovery.scene.referenceTrack')}</text>
          <text x="170" y="300" fontSize="8" letterSpacing="2" textAnchor="middle" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.scene.nightCircuit')}</text>

          
          <path className="sig" d="M 182 250 C 330 226, 460 262, 598 250 C 740 238, 856 218, 998 188"
                fill="none" stroke="#EE4A26" strokeWidth="1.75"/>
          <text x="330" y="212" fontSize="8" letterSpacing="2" fill="rgba(246,244,239,.4)">{t('sonicDiscovery.scene.oneSignal')}</text>
        </g>

        
        <g className="plx" data-plx="0.1">
          
          <circle cx="600" cy="250" r="92" fill="none" stroke="rgba(246,244,239,.3)" strokeWidth="1"
                  strokeDasharray="380 200" transform="rotate(-58 600 250)"/>
          <circle cx="600" cy="250" r="118" fill="none" stroke="rgba(246,244,239,.12)" strokeWidth="1"
                  strokeDasharray="150 592" transform="rotate(96 600 250)"/>
          <circle cx="600" cy="250" r="46" fill="none" stroke="rgba(246,244,239,.22)" strokeWidth="1"
                  strokeDasharray="180 110" transform="rotate(30 600 250)"/>
          
          <g stroke="rgba(246,244,239,.42)" strokeWidth="1">
            <line x1="600" y1="128" x2="600" y2="146"/>
            <line x1="600" y1="354" x2="600" y2="372"/>
            <line x1="478" y1="250" x2="496" y2="250"/>
            <line x1="704" y1="250" x2="722" y2="250"/>
          </g>
          <line x1="530" y1="180" x2="546" y2="196" stroke="rgba(246,244,239,.22)"/>
          <line x1="670" y1="304" x2="654" y2="288" stroke="rgba(246,244,239,.22)"/>
          
          <rect x="593" y="243" width="14" height="14" fill="#0B0B0C"
                stroke="rgba(238,74,38,.85)" transform="rotate(45 600 250)"/>
          
          <use href={'#' + uid + '-dt-s'} x="536" y="196" opacity=".38"/>
          <use href={'#' + uid + '-dt-m'} x="664" y="212" opacity=".42" className="breathe"/>
          <use href={'#' + uid + '-dt-s'} x="558" y="312" opacity=".34"/>
          <use href={'#' + uid + '-dt-s'} x="648" y="296" opacity=".38"/>
          <use href={'#' + uid + '-dt-m'} x="516" y="262" opacity=".32"/>
          <use href={'#' + uid + '-dt-s'} x="600" y="180" opacity=".3"/>
          <use href={'#' + uid + '-dt-s'} x="686" y="258" opacity=".34"/>
          <use href={'#' + uid + '-dt-s'} x="566" y="238" opacity=".38"/>
          
          <text x="600" y="112" fontSize="11" letterSpacing="3.5" textAnchor="middle" fill="rgba(246,244,239,.95)">{t('sonicDiscovery.scene.pyxis1')}</text>
          <text x="600" y="398" fontSize="8.5" letterSpacing="1.8" textAnchor="middle" fill="rgba(246,244,239,.65)">{t('sonicDiscovery.scene.comparesIndex')}</text>
        </g>

        
        <g>
          <text x="1150" y="146" fontSize="10" letterSpacing="2" textAnchor="end" fill="rgba(246,244,239,.8)">{t('sonicDiscovery.scene.closestMatches')}</text>
          
          <line x1="1000" y1="176" x2="1000" y2="332" stroke="rgba(246,244,239,.26)" strokeWidth="1"/>
          <g className="resolve d1">
            <line x1="1000" y1="184" x2="1022" y2="184" stroke="rgba(238,74,38,.8)" strokeWidth="1.2"/>
            <circle cx="1030" cy="184" r="12" fill={'url(#' + uid + '-halo1)'}/>
            <circle cx="1030" cy="184" r="4.2" fill="#EE4A26"/>
            <circle cx="1030" cy="184" r="8.5" fill="none" stroke="rgba(238,74,38,.45)"/>
            <text x="1048" y="188" fontSize="9" letterSpacing="1.5" fill="#EE4A26">01</text>
          </g>
          <g className="resolve d2">
            <line x1="1000" y1="220" x2="1024" y2="220" stroke="rgba(246,244,239,.3)"/>
            <circle cx="1030" cy="220" r="3.4" fill="rgba(246,244,239,.95)"/>
            <text x="1048" y="224" fontSize="9" letterSpacing="1.5" fill="rgba(246,244,239,.7)">02</text>
          </g>
          <g className="resolve d3">
            <line x1="1000" y1="256" x2="1024" y2="256" stroke="rgba(246,244,239,.26)"/>
            <circle cx="1030" cy="256" r="3.4" fill="rgba(246,244,239,.88)"/>
            <text x="1048" y="260" fontSize="9" letterSpacing="1.5" fill="rgba(246,244,239,.66)">03</text>
          </g>
          <g className="resolve d4">
            <line x1="1000" y1="292" x2="1024" y2="292" stroke="rgba(246,244,239,.22)"/>
            <circle cx="1030" cy="292" r="3.4" fill="rgba(246,244,239,.8)"/>
            <text x="1048" y="296" fontSize="9" letterSpacing="1.5" fill="rgba(246,244,239,.62)">04</text>
          </g>
          <g className="resolve d5">
            <line x1="1000" y1="328" x2="1024" y2="328" stroke="rgba(246,244,239,.18)"/>
            <circle cx="1030" cy="328" r="3.4" fill="rgba(246,244,239,.72)"/>
            <text x="1048" y="332" fontSize="9" letterSpacing="1.5" fill="rgba(246,244,239,.58)">05</text>
          </g>
          <path d="M 1000 346 H 1084 M 1000 346 V 340 M 1084 346 V 340" fill="none" stroke="rgba(246,244,239,.3)" strokeWidth="1"/>
          <text x="1042" y="370" fontSize="10.5" letterSpacing="2" textAnchor="middle" fill="rgba(246,244,239,.85)">{t('sonicDiscovery.scene.playlistTitle')}</text>
        </g>
      </svg>
        <svg className="sd-s1-mobile" viewBox="0 0 390 560" role="img"
           aria-label={t('sonicDiscovery.scene.figureAltMobile')}>
        <defs>
          <radialGradient id={uid + '-fog1m'} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="rgba(210,120,62,.1)"/>
            <stop offset="1" stopColor="rgba(210,120,62,0)"/>
          </radialGradient>
          <radialGradient id={uid + '-halo1m'} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="rgba(238,74,38,.32)"/>
            <stop offset="1" stopColor="rgba(238,74,38,0)"/>
          </radialGradient>
        </defs>
        <ellipse cx="300" cy="470" rx="180" ry="90" fill={'url(#' + uid + '-fog1m)'}/>
        <polygon points="26,120 146,110 150,138 30,150" fill="#0D0D0F" stroke="rgba(246,244,239,.05)"/>
        <polygon points="250,40 360,52 356,76 248,66" fill="#0C0C0E" stroke="rgba(246,244,239,.045)"/>

        
        <circle cx="195" cy="78" r="26" fill={'url(#' + uid + '-halo1m)'}/>
        <circle cx="195" cy="78" r="10" fill="none" stroke="rgba(238,74,38,.55)"/>
        <circle cx="195" cy="78" r="4" fill="#EE4A26"/>
        <text x="195" y="38" fontSize="9.5" letterSpacing="2.5" textAnchor="middle" fill="rgba(246,244,239,.95)">{t('sonicDiscovery.scene.referenceTrack')}</text>
        <text x="195" y="116" fontSize="7.5" letterSpacing="1.5" textAnchor="middle" fill="rgba(246,244,239,.5)">{t('sonicDiscovery.scene.nightCircuit')}</text>

        <path className="sig" d="M 195 128 V 196" fill="none" stroke="#EE4A26" strokeWidth="1.75"/>

        
        <circle cx="195" cy="252" r="56" fill="none" stroke="rgba(246,244,239,.3)"
                strokeDasharray="230 122" transform="rotate(-58 195 252)"/>
        <circle cx="195" cy="252" r="74" fill="none" stroke="rgba(246,244,239,.12)"
                strokeDasharray="95 370" transform="rotate(96 195 252)"/>
        <g stroke="rgba(246,244,239,.42)">
          <line x1="195" y1="178" x2="195" y2="190"/>
          <line x1="195" y1="314" x2="195" y2="326"/>
          <line x1="118" y1="252" x2="130" y2="252"/>
          <line x1="260" y1="252" x2="272" y2="252"/>
        </g>
        <rect x="189" y="246" width="12" height="12" fill="#0B0B0C"
              stroke="rgba(238,74,38,.85)" transform="rotate(45 195 252)"/>
        <circle cx="160" cy="222" r="1.5" fill="rgba(246,244,239,.38)"/>
        <circle cx="232" cy="232" r="2.2" fill="rgba(246,244,239,.42)" className="breathe"/>
        <circle cx="168" cy="286" r="1.5" fill="rgba(246,244,239,.34)"/>
        <circle cx="228" cy="278" r="1.5" fill="rgba(246,244,239,.38)"/>
        <text x="286" y="238" fontSize="9.5" letterSpacing="2.5" fill="rgba(246,244,239,.95)">{t('sonicDiscovery.scene.pyxis1')}</text>
        <text x="195" y="348" fontSize="7.2" letterSpacing="1.2" textAnchor="middle" fill="rgba(246,244,239,.65)">{t('sonicDiscovery.scene.comparesWith')}</text>
        <text x="195" y="361" fontSize="7.2" letterSpacing="1.2" textAnchor="middle" fill="rgba(246,244,239,.65)">{t('sonicDiscovery.scene.thePreAnalysed')}</text>

        <path className="sig" d="M 195 330 V 330 M 195 368 V 400" fill="none" stroke="#EE4A26" strokeWidth="1.75"/>

        
        <text x="195" y="416" fontSize="8.8" letterSpacing="1.6" textAnchor="middle" fill="rgba(246,244,239,.8)">{t('sonicDiscovery.scene.closestMatches')}</text>
        <line x1="160" y1="428" x2="160" y2="530" stroke="rgba(246,244,239,.26)"/>
        <g className="resolve d1">
          <line x1="160" y1="436" x2="176" y2="436" stroke="rgba(238,74,38,.8)" strokeWidth="1.2"/>
          <circle cx="184" cy="436" r="9" fill={'url(#' + uid + '-halo1m)'}/>
          <circle cx="184" cy="436" r="3.8" fill="#EE4A26"/>
          <text x="200" y="440" fontSize="8.5" letterSpacing="1.4" fill="#EE4A26">01</text>
        </g>
        <g className="resolve d2">
          <line x1="160" y1="459" x2="179" y2="459" stroke="rgba(246,244,239,.3)"/>
          <circle cx="184" cy="459" r="3" fill="rgba(246,244,239,.95)"/>
          <text x="200" y="463" fontSize="8.5" letterSpacing="1.4" fill="rgba(246,244,239,.7)">02</text>
        </g>
        <g className="resolve d3">
          <line x1="160" y1="482" x2="179" y2="482" stroke="rgba(246,244,239,.26)"/>
          <circle cx="184" cy="482" r="3" fill="rgba(246,244,239,.88)"/>
          <text x="200" y="486" fontSize="8.5" letterSpacing="1.4" fill="rgba(246,244,239,.66)">03</text>
        </g>
        <g className="resolve d4">
          <line x1="160" y1="505" x2="179" y2="505" stroke="rgba(246,244,239,.22)"/>
          <circle cx="184" cy="505" r="3" fill="rgba(246,244,239,.8)"/>
          <text x="200" y="509" fontSize="8.5" letterSpacing="1.4" fill="rgba(246,244,239,.62)">04</text>
        </g>
        <g className="resolve d5">
          <line x1="160" y1="528" x2="179" y2="528" stroke="rgba(246,244,239,.18)"/>
          <circle cx="184" cy="528" r="3" fill="rgba(246,244,239,.72)"/>
          <text x="200" y="532" fontSize="8.5" letterSpacing="1.4" fill="rgba(246,244,239,.58)">05</text>
        </g>
        <path d="M 156 540 H 232 M 156 540 V 534 M 232 540 V 534" fill="none" stroke="rgba(246,244,239,.3)" strokeWidth="1"/>
        <text x="195" y="556" fontSize="9.5" letterSpacing="1.8" textAnchor="middle" fill="rgba(246,244,239,.85)">{t('sonicDiscovery.scene.playlistTitle')}</text>
      </svg>
      </div>

      <div className="sd-fig-caption">
        <span>
          {t('sonicDiscovery.hero.refCaption')}{' '}
          <b>{t('sonicDiscovery.scene.nightCircuit')}</b>
          {' · '}
          {t('sonicDiscovery.scene.refMeta')}
        </span>
        <span className="uppercase">{t('sonicDiscovery.hero.refCaptionNote')}</span>
      </div>
    </div>
  );
}
