import { tValue } from '@/lib/i18n'
import { canonicalUrl, ROUTE_SEO } from '@/lib/seo'
import { SITE_ORIGIN, OG_IMAGE } from '@/lib/site'

export interface FaqItem {
  q: string
  a: string
}

export function homeFaqItems(): FaqItem[] {
  return tValue<FaqItem[]>('home.faq.items')
}

/** Homepage FAQ + WebPage nodes. Same shape the Vite prerender writes for `/`. */
export function homeJsonLd(): Record<string, unknown> {
  const url = canonicalUrl('/')
  const seo = ROUTE_SEO['/']
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: seo.title,
        description: seo.description,
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        about: { '@id': `${SITE_ORIGIN}/#organization` },
        inLanguage: 'en',
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: homeFaqItems().map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  }
}

const SAME_AS_KEYS = [
  'NEXT_PUBLIC_FACEBOOK_URL',
  'NEXT_PUBLIC_INSTAGRAM_URL',
  'NEXT_PUBLIC_TWITTER_URL',
  'NEXT_PUBLIC_SOUNDCLOUD_URL',
] as const

/** Site-level Organization / WebSite graph. */
export function siteJsonLd(): Record<string, unknown> {
  const sameAs = SAME_AS_KEYS.map((key) => process.env[key]?.trim() ?? '').filter((url) =>
    /^https?:\/\/\S+$/.test(url),
  )
  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: 'Resomix',
    url: `${SITE_ORIGIN}/`,
    logo: OG_IMAGE,
    description:
      'Resomix is a music similarity search and audio analysis platform for discovering, analysing and indexing music by sound.',
    foundingLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: 'Thessaloniki', addressCountry: 'GR' },
    },
    contactPoint: [
      { '@type': 'ContactPoint', contactType: 'customer support', email: 'support@resomix.com', availableLanguage: 'en' },
      { '@type': 'ContactPoint', contactType: 'sales', email: 'partners@resomix.com', availableLanguage: 'en' },
      { '@type': 'ContactPoint', contactType: 'legal', email: 'legal@resomix.com', availableLanguage: 'en' },
      { '@type': 'ContactPoint', contactType: 'privacy', email: 'privacy@resomix.com', availableLanguage: 'en' },
    ],
  }
  if (sameAs.length > 0) organization.sameAs = sameAs

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        url: `${SITE_ORIGIN}/`,
        name: 'Resomix',
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      },
    ],
  }
}
