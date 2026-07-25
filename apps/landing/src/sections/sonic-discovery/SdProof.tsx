import { useTranslation } from 'react-i18next';

export function SdProof() {
  const { t } = useTranslation('common');

  const specs = [
    { term: t('sonicDiscovery.proof.s1t'), body: t('sonicDiscovery.proof.s1') },
    { term: t('sonicDiscovery.proof.s2t'), body: t('sonicDiscovery.proof.s2') },
    { term: t('sonicDiscovery.proof.s3t'), body: t('sonicDiscovery.proof.s3') },
    { term: t('sonicDiscovery.proof.s4t'), body: t('sonicDiscovery.proof.s4') },
    { term: t('sonicDiscovery.proof.s5t'), body: t('sonicDiscovery.proof.s5') },
    { term: t('sonicDiscovery.proof.s6t'), body: t('sonicDiscovery.proof.s6') },
  ];

  const valSteps = [
    { title: t('sonicDiscovery.proof.v1t'), body: t('sonicDiscovery.proof.v1') },
    { title: t('sonicDiscovery.proof.v2t'), body: t('sonicDiscovery.proof.v2') },
    { title: t('sonicDiscovery.proof.v3t'), body: t('sonicDiscovery.proof.v3') },
    { title: t('sonicDiscovery.proof.v4t'), body: t('sonicDiscovery.proof.v4') },
    { title: t('sonicDiscovery.proof.v5t'), body: t('sonicDiscovery.proof.v5') },
  ];

  return (
    <section id="sd-proof" className="sd-section" aria-label="Proof and validation">
      <header className="sd-dim-intro">
        <p className="sd-eyebrow uppercase">{t('sonicDiscovery.proof.eyebrow')}</p>
        <h2 className="sd-h2b uppercase">{t('sonicDiscovery.proof.title')}</h2>
        <p className="sd-lead">{t('sonicDiscovery.proof.lead')}</p>
      </header>

      <div className="sd-specgrid">
        {specs.map((s) => (
          <div key={s.term} className="sd-spec">
            <span className="sd-spec-term uppercase">{s.term}</span>
            <p>{s.body}</p>
          </div>
        ))}
      </div>

      <div className="sd-valflow">
        <span className="sd-hudlbl uppercase">{t('sonicDiscovery.proof.valHead')}</span>
        <div className="sd-valsteps">
          {valSteps.map((step) => (
            <div key={step.title} className="sd-valstep">
              <span className="sd-vt uppercase">{step.title}</span>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
        <p className="sd-valfoot sd-lbl-dim">{t('sonicDiscovery.proof.valFoot')}</p>
      </div>

      <div className="sd-reserved" role="note" aria-label="Reserved module for approved beta feedback">
        <span className="sd-corner sd-c1" aria-hidden="true" />
        <span className="sd-corner sd-c2" aria-hidden="true" />
        <span className="sd-corner sd-c3" aria-hidden="true" />
        <span className="sd-corner sd-c4" aria-hidden="true" />
        <span className="sd-rt uppercase">{t('sonicDiscovery.proof.reserved')}</span>
        <p className="uppercase">{t('sonicDiscovery.proof.reservedNote')}</p>
      </div>
    </section>
  );
}
