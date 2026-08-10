import { useTranslation } from 'react-i18next';

export function DevCapabilityLanes() {
  const { t } = useTranslation('common');

  const lanes = t('developers.capabilities.lanes', { returnObjects: true }) as {
    question: string;
    tag?: string;
    ioIn: string;
    ioOut: string;
    endpoints: { method: string; path: string }[];
    status: string;
    /** Chip variant: live | avail | plan | gate. Defaults to `live` so a lane that
     *  omits it keeps the badge it had before this field existed. */
    statusClass?: string;
  }[];

  const headers = t('developers.capabilities.headers', { returnObjects: true }) as string[];

  return (
    <section id="dev-capabilities" className="dev-section" aria-label="What the API does">
      <header className="dev-dim-intro">
        <p className="dev-eyebrow uppercase">{t('developers.capabilities.eyebrow')}</p>
        <h2 className="dev-h2b uppercase">{t('developers.capabilities.title')}</h2>
      </header>
      <div className="dev-lanes">
        <div className="dev-lanes-head uppercase">
          {headers.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        {lanes.map((lane) => (
          <div key={lane.question} className="dev-lane-row">
            <p className="dev-q">
              {lane.question}
              {lane.tag ? (
                <span className="dev-lbl-dim dev-q-tag uppercase">{lane.tag}</span>
              ) : null}
            </p>
            <p className="dev-io">
              <b>in:</b> {lane.ioIn}
              <br />
              <b>out:</b> {lane.ioOut}
            </p>
            <p className="dev-ep">
              {lane.endpoints.map((ep, i) => (
                <span key={ep.path}>
                  {i > 0 ? <br /> : null}
                  <span className="dev-m">{ep.method}</span> {ep.path}
                </span>
              ))}
            </p>
            <span className={`dev-st dev-st-${lane.statusClass ?? 'live'} uppercase`}>
              {lane.status}
            </span>
          </div>
        ))}
      </div>
      <p className="dev-lbl-dim dev-footnote">{t('developers.capabilities.footnote')}</p>
      <p className="dev-body dev-cap-note">{t('developers.capabilities.partialFieldsNote')}</p>
    </section>
  );
}
