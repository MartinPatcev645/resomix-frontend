import { t } from '@/lib/i18n'

/** Renders a translation that contains a single `<a>…</a>` the way `<Trans>` did. */
export function RichText({ i18nKey, href }: { i18nKey: string; href: string }) {
  const raw = t(i18nKey)
  const match = raw.match(/^([\s\S]*?)<a>([\s\S]*?)<\/a>([\s\S]*)$/)
  if (!match) return raw
  return (
    <>
      {match[1]}
      <a className="rx-copylink" href={href}>
        {match[2]}
      </a>
      {match[3]}
    </>
  )
}
