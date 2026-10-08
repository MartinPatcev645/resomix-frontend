import { Fragment } from 'react'
import { t, tValue } from '@/lib/i18n'
import type { FaqItem } from '@/lib/jsonld'

/** Home FAQ. Open list, same classes the shared family used for `hm`. */
export function FaqSection() {
  const items = tValue<FaqItem[]>('home.faq.items')
  if (items.length === 0) return null
  const title = t('home.faq.title')

  return (
    <section id="hm-faq" className="hm-section" aria-label={title}>
      <div className="hm-frame">
        <p className="hm-eyebrow uppercase">{t('home.faq.eyebrow')}</p>
        <h2 className="hm-h2b uppercase">{title}</h2>
        <dl className="faq-list">
          {items.map((item) => (
            <Fragment key={item.q}>
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </section>
  )
}
