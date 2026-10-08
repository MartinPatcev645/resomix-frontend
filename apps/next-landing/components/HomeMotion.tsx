'use client'

import { useEffect } from 'react'

/** Toggles motion classes after mount so the server HTML stays stable. */
export function HomeMotion() {
  useEffect(() => {
    const root = document.querySelector('.hm-page')
    if (!(root instanceof HTMLElement)) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) return

    root.classList.remove('hm-motion-reduced')
    root.classList.add('hm-motion-on')

    const sections = Array.from(root.querySelectorAll('.hm-section'))
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) en.target.classList.add('hm-anim')
          else en.target.classList.remove('hm-anim')
        })
      },
      { threshold: 0.05 },
    )
    sections.forEach((section) => io.observe(section))
    return () => {
      io.disconnect()
      root.classList.remove('hm-motion-on')
      root.classList.add('hm-motion-reduced')
    }
  }, [])

  return null
}
