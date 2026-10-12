'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CodeTyping } from './CodeTyping'

/** Default from the shared config store. The homepage has no live config fetch. */
const APP_VERSION = 'open-0.10.2'

function useGenerationTime(): string {
  const [value, setValue] = useState('')
  useEffect(() => {
    const totalSeconds = Math.floor(Math.random() * 1200) + 1
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const next =
      minutes === 0 ? `${seconds}s` : seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
    const id = window.setTimeout(() => setValue(next), 0)
    return () => window.clearTimeout(id)
  }, [])
  return value
}

function openCookies(event: { preventDefault: () => void }) {
  event.preventDefault()
  const icon = document.querySelector('#stcm-icon')
  if (icon instanceof HTMLElement) icon.click()
}

export function GlobalFooter({
  logo,
  onNavigate,
}: {
  logo: ReactNode
  onNavigate: (path: string) => void
}) {
  const generationTime = useGenerationTime()
  const waveform = generationTime
    ? `upload_protocol: SSL 256-bit // encrypted<br />system_uptime: 99.97%<br />last_waveform_uploaded: ${generationTime} ago`
    : 'upload_protocol: SSL 256-bit // encrypted<br />system_uptime: 99.97%<br />last_waveform_uploaded: '

  return (
    <footer
      className="mt-[var(--px-150)] pb-[var(--px-30)] relative z-15 min-h-[var(--px-275)]"
      style={{ '--footer-headline-size': 'clamp(50.4px, 4.921875vw, 126px)' } as React.CSSProperties}
    >
      <div
        aria-hidden="true"
        className="absolute -left-[var(--px-63)] top-[var(--px-180)] min-w-[var(--px-1280)] font-benzin uppercase whitespace-nowrap"
        style={{ fontSize: 'var(--footer-headline-size)', lineHeight: 1.5 }}
      >
        Join the Resomix Universe
      </div>
      <div
        className="flex flex-col"
        style={{
          rowGap: 'calc(var(--px-130) + max(0px, (var(--footer-headline-size) - var(--px-63)) * 1.5))',
        }}
      >
        <div className="flex flex-col px-[var(--px-65)] min-h-[var(--px-129)]">
          <div className="flex w-full justify-start">
            <Link
              href="/"
              aria-label="Resomix home"
              className="cursor-default footer-logo-link"
              id="footer-logo-link"
              onClick={(e) => {
                e.preventDefault()
                onNavigate('/')
              }}
            >
              {logo}
            </Link>
          </div>
          <div className="flex justify-between">
            <div className="flex flex-col text-[length:var(--px-10)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
              <div className="leading-[var(--px-40)]">
                <CodeTyping speed={50} text="// ──────[ resomix &gt; footer_terminal ]──────" />
              </div>
              <div className="leading-[var(--px-12)]">
                <CodeTyping
                  speed={50}
                  text={`company_name: Resomix<br />status: online [✓]<br />version: ${APP_VERSION}`}
                  multiline
                />
              </div>
              <div className="leading-[var(--px-12)] mt-[var(--px-20)]">
                <CodeTyping
                  speed={120}
                  text="contact@email: support@resomix.com<br />HQ_coords: RA 0h 42m 44s | Dec +41° 16′ 9″ // Andromeda<br />address: resomix.com"
                  multiline
                />
              </div>
            </div>
            <div className="flex flex-col text-[length:var(--px-10)] text-right font-light font-fira opacity-50 tracking-[var(--px-2)] items-end">
              <div className="leading-[var(--px-12)]">
                <CodeTyping speed={50} text={waveform} multiline />
              </div>
              <div className="leading-[var(--px-12)] mt-[var(--px-57)]">
                <CodeTyping
                  speed={100}
                  text="PYXIS-1 Sonic Analysis Engine: v5.3.9<br />latency: zero-latency-mode = active<br />data_nodes: [New York] [London] [Singapore]"
                  multiline
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between px-[var(--px-65)]">
          <div className="flex flex-col text-[length:var(--px-10)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
            <CodeTyping speed={50} text="© 2026 Resomix // Beta Stage" multiline />
          </div>
          <div className="flex flex-col text-[length:var(--px-10)] text-right font-light font-fira tracking-[var(--px-2)] items-end">
            <a
              href="https://legal.resomix.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Resomix legal information"
              className="inline-flex min-h-[var(--px-24)] items-center justify-end px-[var(--px-8)] py-[var(--px-2)] hover:underline decoration-[var(--px-0-5)] opacity-50 hover:opacity-100 transition-opacity footer-link"
              id="footer-legal-link"
            >
              {"legal.info(): open('/legal')"}
            </a>
            <a
              href="https://support.resomix.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Resomix support"
              className="inline-flex min-h-[var(--px-24)] items-center justify-end px-[var(--px-8)] py-[var(--px-2)] hover:underline decoration-[var(--px-0-5)] opacity-50 hover:opacity-100 transition-opacity footer-link"
              id="footer-support-link"
            >
              {"support.to(): open('/support')"}
            </a>
            <br />
            <a
              href="/contact"
              aria-label="Resomix contact"
              className="inline-flex min-h-[var(--px-24)] items-center justify-end px-[var(--px-8)] py-[var(--px-2)] hover:underline decoration-[var(--px-0-5)] opacity-50 hover:opacity-100 transition-opacity footer-link"
              id="footer-contact-link"
              onClick={(e) => {
                e.preventDefault()
                onNavigate('/contact')
              }}
            >
              {"contact_us(): fetch('/contact')"}
            </a>
            <button
              type="button"
              className="inline-flex min-h-[var(--px-24)] items-center justify-end px-[var(--px-8)] py-[var(--px-2)] hover:underline decoration-[var(--px-0-5)] opacity-50 hover:opacity-100 transition-opacity footer-link cursor-pointer text-right"
              onClick={openCookies}
            >
              {"privacy.preferences(): open('/cookies')"}
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function GlobalMobileFooter({
  logo,
  onNavigate,
}: {
  logo: ReactNode
  onNavigate: (path: string) => void
}) {
  return (
    <footer className="mt-[var(--px-250)] pb-[var(--px-30)] relative z-15 min-h-[var(--px-275)]">
      <div className="flex flex-col w-full">
        <div className="absolute -left-[var(--px-20)] -top-[var(--px-80)] w-[var(--px-393)] text-[length:var(--px-30)] font-benzin uppercase leading-[var(--px-40)]">
          Join the Resomix
          <br />
          Universe
        </div>
        <div className="flex flex-col items-start px-[var(--px-10)] min-h-[var(--px-129)] mt-[var(--px-40)]">
          <div className="flex w-full justify-start">
            <Link
              href="/"
              aria-label="Resomix home"
              className="cursor-default footer-logo-link"
              id="footer-logo-link-mobile"
              onClick={(e) => {
                e.preventDefault()
                onNavigate('/')
              }}
            >
              {logo}
            </Link>
          </div>
          <div className="flex justify-between">
            <div className="flex flex-col text-[length:var(--px-12)] font-light font-fira tracking-[var(--px-2)] leading-[var(--px-16)]">
              <div className="my-[var(--px-14)]">
                <CodeTyping speed={50} text="// ──────[ resomix &gt;<br />footer_terminal ]──────" multiline />
              </div>
              <div>
                <CodeTyping
                  speed={50}
                  text={`company_name: Resomix<br />status: online [✓]<br />version: ${APP_VERSION}`}
                  multiline
                />
              </div>
              <div className="mt-[var(--px-20)]">
                <CodeTyping
                  speed={120}
                  text="contact@email: support@resomix.com<br />HQ_coords: RA 0h 42m 44s | Dec +41° 16′ 9″ // Andromeda<br />address: resomix.com"
                  multiline
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center text-center justify-between">
          <div className="flex flex-col text-[length:var(--px-12)] font-light font-fira tracking-[var(--px-2)] items-center my-[var(--px-60)]">
            <a
              href="https://legal.resomix.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Resomix legal information"
              className="inline-flex min-h-[var(--px-24)] items-center px-[var(--px-8)] py-[var(--px-6)] hover:underline decoration-[var(--px-0-5)] footer-link"
              id="footer-legal-link-mobile"
            >
              legal.info()
            </a>
            <a
              href="https://support.resomix.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Resomix support"
              className="inline-flex min-h-[var(--px-24)] items-center px-[var(--px-8)] py-[var(--px-6)] hover:underline decoration-[var(--px-0-5)] footer-link"
              id="footer-support-link-mobile"
            >
              support.to()
            </a>
            <br />
            <br />
            <a
              href="/contact"
              aria-label="Resomix contact"
              className="inline-flex min-h-[var(--px-24)] items-center px-[var(--px-8)] py-[var(--px-6)] hover:underline decoration-[var(--px-0-5)] footer-link"
              id="footer-contact-link-mobile"
              onClick={(e) => {
                e.preventDefault()
                onNavigate('/contact')
              }}
            >
              contact_us()
            </a>
            <button
              type="button"
              className="hover:underline decoration-[var(--px-0-5)] footer-link mt-[var(--px-20)] cursor-pointer"
              onClick={openCookies}
            >
              privacy.preferences()
            </button>
          </div>
          <div className="flex flex-col text-[length:var(--px-12)] font-light font-fira tracking-[var(--px-2)]">
            <CodeTyping speed={50} text="© 2026 Resomix<br />// Beta Stage" multiline />
          </div>
        </div>
      </div>
    </footer>
  )
}
