import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SG, sgDisplayName, API_DOCS_URL, type SgKey, codeToPlainText } from './devEngine.ts';
import { DevCodeBlock } from './DevCodeBlock.tsx';
import { DevCopyButton } from './DevCopyButton.tsx';

const SG_KEYS: SgKey[] = ['rhythm', 'tonality', 'loudness', 'mood', 'structure', 'prov'];

type DevSchemaMapProps = {
  onCopy: (label: string) => void;
};

export function DevSchemaMap({ onCopy }: DevSchemaMapProps) {
  const { t } = useTranslation('common');
  const [selected, setSelected] = useState<SgKey>('rhythm');
  const [mobileExpanded, setMobileExpanded] = useState<SgKey | null>('rhythm');

  const groups = t('developers.schema.groups', { returnObjects: true }) as Record<
    SgKey,
    { num: string; title: string; desc: string }
  >;

  const handleSelect = useCallback((key: SgKey) => {
    setSelected(key);
    setMobileExpanded((prev) => (prev === key ? null : key));
  }, []);

  return (
    <section id="dev-schema" className="dev-section" aria-label="What analysis returns">
      <header className="dev-dim-intro">
        <p className="dev-eyebrow uppercase">{t('developers.schema.eyebrow')}</p>
        <h2 className="dev-h2b uppercase">{t('developers.schema.title')}</h2>
      </header>
      <div className="dev-schema">
        <div className="dev-schema-groups" role="group" aria-label="Analysis output groups, select one to preview its fields">
          {SG_KEYS.map((key) => {
            const g = groups[key];
            const pressed = selected === key;
            const expanded = mobileExpanded === key;
            return (
              <button
                key={key}
                type="button"
                className={`dev-sg${expanded ? ' dev-sg-expanded' : ''}`}
                aria-pressed={pressed}
                aria-expanded={expanded}
                onClick={() => handleSelect(key)}
              >
                <span className="dev-sg-n">{g.num}</span>
                <span className="dev-sg-t uppercase">{g.title}</span>
                <span className="dev-sg-d">{g.desc}</span>
              </button>
            );
          })}
        </div>
        <div>
          <div className="dev-codelbl">
            <span className="dev-lbl uppercase">
              {t('developers.schema.fragmentLabel')}{' '}
              <span className="dev-sg-name">{sgDisplayName(selected)}</span>
            </span>
            <span className="dev-lbl-dim uppercase">{t('developers.schema.fragmentNote')}</span>
          </div>
          <div className="dev-code dev-jsonwrap">
            <DevCopyButton getText={() => codeToPlainText(SG[selected])} onCopy={onCopy} />
            <DevCodeBlock lines={SG[selected]} id="dev-sg-json" />
          </div>
          <p className="dev-interp dev-schema-note">
            <b>{t('developers.schema.defensiveBold')}</b> {t('developers.schema.defensiveBody')}
          </p>
          <a
            className="dev-bracket dev-schema-link uppercase"
            href={API_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('developers.schema.exploreLink')}
          </a>
        </div>
      </div>
    </section>
  );
}
