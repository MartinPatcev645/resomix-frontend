import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FAQ_FAMILIES, type FaqNamespace } from './faqFamilies.ts';
import './faq.css';

interface FaqItem {
  q: string;
  a: string;
  /**
   * Optional call to action under the answer, in the site's bracket-link style. An internal path,
   * hash allowed: LandingLayout scrolls to the anchor once the target page has mounted. It is a
   * real `<a href>` in the static HTML, so crawlers can follow it. The FAQPage schema keeps the
   * answer text only, which is why the link sits beside the answer and not inside it.
   */
  link?: { label: string; to: string };
}

/**
 * Questions in the words people type into an AI assistant, answered on the page.
 *
 * The ShelfSignal report of September 2026 found assistants reading our pages without naming
 * Resomix, and being absent from 17 of 20 buyer questions. A visible Q&A in the buyer's own words
 * is the most direct answer to both, and it is the content `FAQPage` structured data requires.
 *
 * The copy lives in the page's locale file under `<ns>.faq`. The build reads the same strings to
 * emit the `FAQPage` JSON-LD (vite.config.ts), so the markup cannot describe a question a visitor
 * cannot see. The list is rendered open, never collapsed, for the same reason.
 */
export function FaqSection({ ns }: { ns: FaqNamespace }) {
  const { t } = useTranslation('common');
  const items = t(`${ns}.faq.items`, { returnObjects: true }) as FaqItem[] | string;
  if (!Array.isArray(items) || items.length === 0) return null;

  const c = FAQ_FAMILIES[ns];
  const Eyebrow = c.eyebrowTag;

  const heading = (
    <>
      <Eyebrow className={c.eyebrow}>{t(`${ns}.faq.eyebrow`)}</Eyebrow>
      <h2 className={c.h2}>{t(`${ns}.faq.title`)}</h2>
    </>
  );

  const body = (
    <>
      {c.header ? <header className={c.header}>{heading}</header> : heading}
      <dl className="faq-list">
        {items.map((item) => (
          <Fragment key={item.q}>
            <dt>{item.q}</dt>
            <dd>
              {item.a}
              {item.link ? (
                <>
                  {' '}
                  <Link className="faq-link font-fira" to={item.link.to}>
                    {item.link.label}
                  </Link>
                </>
              ) : null}
            </dd>
          </Fragment>
        ))}
      </dl>
    </>
  );

  return (
    <section id={c.id} className={c.section} aria-label={t(`${ns}.faq.title`)}>
      {c.inner ? <div className={c.inner}>{body}</div> : body}
    </section>
  );
}
