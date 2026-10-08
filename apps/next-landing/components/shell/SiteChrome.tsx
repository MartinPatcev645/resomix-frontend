'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { BetaNotice, LogoRFooter } from '@/components'
import type { CoreCopy } from '@/lib/i18n'
import { CopyProvider } from './copy'
import { GlobalFooter, GlobalMobileFooter } from './Footer'
import { MobileDrawer } from './MobileDrawer'
import { SideLines } from './SideLines'
import { SiteHeader } from './SiteHeader'

export function SiteChrome({ copy, children }: { copy: CoreCopy; children: ReactNode }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const onNavigate = (path: string) => {
    if (/^https?:\/\//.test(path)) {
      window.location.assign(path)
      return
    }
    router.push(path)
  }

  const closeMenu = () => {
    setMenuOpen(false)
    requestAnimationFrame(() => menuButtonRef.current?.focus())
  }

  const logo = (
    <LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
  )

  return (
    <CopyProvider copy={copy}>
      <BetaNotice />
      <div
        id="landing-page-root"
        className="bg-[var(--color-secondary)] min-h-screen relative overflow-x-clip"
      >
        <div className="mx-auto text-[var(--color-text-secondary)] relative z-30 max-w-[var(--px-1023)] lg:max-w-[var(--px-2560)]">
          <SideLines
            mode="home"
            navbar={
              <SiteHeader
                variant="mobile"
                onNavigate={onNavigate}
                onMenuOpen={() => setMenuOpen(true)}
                menuButtonRef={menuButtonRef}
              />
            }
          >
            <div className="max-lg:hidden">
              <SiteHeader
                variant="desktop"
                onNavigate={onNavigate}
                onMenuOpen={() => setMenuOpen(true)}
                menuButtonRef={menuButtonRef}
              />
            </div>
            <main className="page-transition lg:pt-[calc(var(--nav-hdr-h,4.25rem)-3px)]">{children}</main>
            <div className="max-lg:hidden">
              <GlobalFooter logo={logo} onNavigate={onNavigate} />
            </div>
            <div className="mt-[var(--px-60)] lg:hidden">
              <GlobalMobileFooter logo={logo} onNavigate={onNavigate} />
            </div>
          </SideLines>
        </div>
        <MobileDrawer isOpen={menuOpen} onClose={closeMenu} onNavigate={onNavigate} />
      </div>
    </CopyProvider>
  )
}
