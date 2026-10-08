import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { ConsentBanner } from '@/components/ConsentBanner'
import { siteJsonLd } from '@/lib/jsonld'
import { SITE_ORIGIN } from '@/lib/site'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#000000',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  applicationName: 'Resomix',
  authors: [{ name: 'Resomix' }],
  icons: { icon: { url: '/logo.png', type: 'image/png' } },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Resomix',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

const consentDefaults = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag("consent", "default", {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  wait_for_update: 500
});
gtag("js", new Date());
gtag("config", "GTM-PD9XQZRV");
`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* The consent manager looks this stylesheet up by id before injecting its own. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link id="resomix-consent-style" rel="stylesheet" href="/scripts/resomix-consent.css" />
        <link rel="preload" href="/fonts/benzin-bold.latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/HelveticaNeueLight.latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/FiraCode-Medium.latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://bserver.resomix.com" crossOrigin="use-credentials" />
        <link rel="author" href="/humans.txt" type="text/plain" />
        <script dangerouslySetInnerHTML={{ __html: consentDefaults }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }} />
      </head>
      <body className="bg-[var(--color-secondary)]">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PD9XQZRV"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
        {children}
        <ConsentBanner />
      </body>
    </html>
  )
}
