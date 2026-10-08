import type { CSSProperties } from 'react'
import { HomeMotion } from '@/components/HomeMotion'
import { FaqSection } from '@/sections/home/FaqSection'
import { HmApi } from '@/sections/home/HmApi'
import { HmAudiences } from '@/sections/home/HmAudiences'
import { HmCatalogue } from '@/sections/home/HmCatalogue'
import { HmFinalCta } from '@/sections/home/HmFinalCta'
import { HmHero } from '@/sections/home/HmHero'
import { HmProductWorlds } from '@/sections/home/HmProductWorlds'
import { HmStartTrack } from '@/sections/home/HmStartTrack'
import { HmStatement } from '@/sections/home/HmStatement'
import { HmTrackIntelligence } from '@/sections/home/HmTrackIntelligence'
import { HmTrust } from '@/sections/home/HmTrust'
import { HmVoidBackground } from '@/sections/home/HmVoidBackground'

const assetVars = {
  '--hm-plate-dark': 'url(/void-field/void-field-dark.webp)',
  '--hm-plate-light': 'url(/void-field/void-field-light.webp)',
  '--hm-grain-dark': 'url(/void-field/void-grain-dark.webp)',
  '--hm-grain-light': 'url(/void-field/void-grain-light.webp)',
} as CSSProperties

export function Home() {
  return (
    <div
      className="hm-page relative text-[var(--color-primary)] font-helvetica font-light hm-motion-reduced"
      style={assetVars}
    >
      <HomeMotion />
      <HmVoidBackground />
      <HmHero />
      <HmStatement />
      <HmProductWorlds />
      <HmStartTrack />
      <HmTrackIntelligence />
      <HmCatalogue />
      <HmApi />
      <HmAudiences />
      <HmTrust />
      <FaqSection />
      <HmFinalCta />
    </div>
  )
}
