import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@resomix/ui';

const API_DOCS_URL = 'https://api-docs.resomix.com/';

const copyIcon = (
  <svg className="w-[var(--px-12)] h-[var(--px-12)] fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const checkIcon = (
  <svg className="w-[var(--px-12)] h-[var(--px-12)] fill-none stroke-black text-black" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PARTNER_CURL = `curl -X POST "/api/v1/similarity/search" \\
  -H "Authorization: Bearer rmx_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "track_id": "trk_71f5e8c0", "top_sk": 20 }'`;

export function ApiFlowBlock() {
  const { t } = useTranslation('common');
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PARTNER_CURL);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section id="developers-api" aria-label="Developers and API path">
      <div className="product-feature-grid product-feature-grid-75">
        <figure
          className="product-hud product-feature-panel"
          aria-label="API flow: a partner API request, PYXIS-1 processing, scored response"
        >
          <div className="product-hud-label-row">
            <figcaption className="product-hud-label">{t('product.dev.panelLabel')}</figcaption>
            <IconButton
              text={copySuccess ? 'Copied!' : 'Copy'}
              onClick={handleCopy}
              icon={copySuccess ? checkIcon : copyIcon}
              transparent
            />
          </div>

          <pre className="product-code-block">
            <code>{PARTNER_CURL}</code>
          </pre>

          <div className="product-flowrow">
            <span className="product-flow-lbl">{t('product.dev.flowRequest')}</span>
            <span className="product-flowline" />
            <span className="product-flow-lbl product-flow-lbl-orange">{t('product.dev.flowProcessing')}</span>
            <span className="product-flowline" />
            <span className="product-flow-lbl">{t('product.dev.flowResponse')}</span>
          </div>

          <p className="product-hud-foot">{t('product.dev.foot')}</p>
        </figure>

        <div className="product-feature-copy">
          <p className="product-microtag product-microtag-orange">
            {t('product.dev.tag')}
            <span className="product-dot" />
          </p>
          <h3 className="product-copy-col-title m-0 font-helvetica uppercase font-light text-[length:var(--px-33)] leading-[var(--px-38)] text-[var(--color-primary)]">
            {t('product.dev.title')}
          </h3>
          <p className="max-w-[48ch] font-helvetica font-light text-[length:var(--px-17)] opacity-70 leading-[var(--px-24)]">
            {t('product.dev.desc')}
          </p>
          <a
            href={API_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="product-bracket-link"
          >
            {t('product.dev.link')}
          </a>
        </div>
      </div>
    </section>
  );
}
