import { useTranslation, Trans } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

function UntaggedArt({ tagged, unseen }: { tagged: string; unseen: string }) {
  return (
    <svg className="sa-sl" viewBox="0 0 360 130" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.28)' }}>
        <rect x="24" y="24" width="92" height="20" />
        <rect x="128" y="24" width="80" height="20" />
        <rect x="220" y="24" width="92" height="20" />
      </g>
      <text x="70" y="38" textAnchor="middle" style={{ fontSize: '9px' }}>
        {tagged}
      </text>
      <text x="168" y="38" textAnchor="middle" style={{ fontSize: '9px' }}>
        {tagged}
      </text>
      <text x="266" y="38" textAnchor="middle" style={{ fontSize: '9px' }}>
        {tagged}
      </text>
      <g style={{ color: 'rgba(255,255,255,.5)' }}>
        <path d="M96 84 l8-8 6 12 8-17 8 20 7-13 6 7 8-4 8 6" />
      </g>
      <rect
        x="84"
        y="66"
        width="90"
        height="40"
        strokeDasharray="3 5"
        style={{ color: 'rgba(238,74,38,.5)' }}
      />
      <text x="188" y="92" style={{ fontSize: '9.5px', fill: '#EE4A26' }}>
        {unseen}
      </text>
    </svg>
  );
}

function ListenersArt({ one, two }: { one: string; two: string }) {
  return (
    <svg className="sa-sl" viewBox="0 0 360 130" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.5)' }}>
        <path d="M28 66 l8-9 7 14 8-19 8 22 7-15 6 8 7-4 7 5 H110" />
      </g>
      <circle cx="116" cy="66" r="3.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
      <g style={{ color: 'rgba(255,255,255,.35)' }}>
        <path d="M116 66 C 170 66 190 34 250 30 C 290 28 320 36 336 42" />
        <path d="M116 66 C 170 66 190 100 250 104 C 290 106 320 98 336 92" />
      </g>
      <text x="240" y="20" style={{ fontSize: '9.5px' }}>
        {one}
      </text>
      <text x="240" y="126" style={{ fontSize: '9.5px' }}>
        {two}
      </text>
    </svg>
  );
}

function SubtletiesArt({ label }: { label: string }) {
  return (
    <svg className="sa-sl" viewBox="0 0 360 130" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.25)' }}>
        <rect x="24" y="30" width="130" height="22" />
        <rect x="24" y="58" width="130" height="22" />
        <rect x="24" y="86" width="130" height="22" />
      </g>
      {/* Illustrative — fictional metadata column labels. */}
      <g style={{ fill: '#6a6a6a' }}>
        <text x="89" y="45" textAnchor="middle" style={{ fontSize: '8.5px' }}>
          Genre
        </text>
        <text x="89" y="73" textAnchor="middle" style={{ fontSize: '8.5px' }}>
          Mood
        </text>
        <text x="89" y="101" textAnchor="middle" style={{ fontSize: '8.5px' }}>
          Tempo
        </text>
      </g>
      <g style={{ color: 'rgba(238,74,38,.65)' }}>
        <path
          d="M196 90 C 220 60 250 44 286 40 C 310 38 328 44 340 52"
          style={{ strokeWidth: 1.8 }}
        />
      </g>
      <g style={{ color: 'rgba(255,255,255,.2)' }}>
        <path d="M196 100 C 230 84 270 76 340 74" />
        <path d="M196 110 C 230 104 270 102 340 100" />
      </g>
      <text x="196" y="30" style={{ fontSize: '9.5px', fill: '#d8d8d8' }}>
        {label}
      </text>
    </svg>
  );
}

export function SaProblems() {
  const { t } = useTranslation('common');

  const items = [
    {
      key: 'untagged',
      num: '01',
      art: (
        <UntaggedArt
          tagged={t('syncAgencies.figures.tagged')}
          unseen={t('syncAgencies.figures.noTagUnseen')}
        />
      ),
    },
    {
      key: 'listeners',
      num: '02',
      art: (
        <ListenersArt
          one={t('syncAgencies.figures.listenerOne')}
          two={t('syncAgencies.figures.listenerTwo')}
        />
      ),
    },
    {
      key: 'subtleties',
      num: '03',
      art: <SubtletiesArt label={t('syncAgencies.figures.theSubtleties')} />,
    },
  ] as const;

  return (
    <section className="sa-section" id="sa-problems">
      <div className="sa-frame">
        <p className="sa-eyebrow uppercase">{t('syncAgencies.problems.eyebrow')}</p>
        <h2 className="sa-h2b uppercase">{t('syncAgencies.problems.h2')}</h2>
        <p className="sa-body">{t('syncAgencies.problems.lead')}</p>

        <div className="sa-tps">
          {items.map((item) => (
            <article key={item.key} className="sa-tp">
              <span className="sa-tp-num">{item.num}</span>
              <div className="sa-tp-art" aria-hidden="true">
                {item.art}
              </div>
              <p className="sa-tp-txt">{t(`syncAgencies.problems.items.${item.key}`)}</p>
            </article>
          ))}
        </div>

        <p className="sa-tp-balance"><Trans i18nKey="syncAgencies.problems.balance" components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={BLOG.supervisors} /> }} /></p>
      </div>
    </section>
  );
}
