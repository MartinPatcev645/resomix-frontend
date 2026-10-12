'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface CodeTypingProps {
  speed?: number
  multiline?: boolean
  delay?: number
  text?: string
  className?: string
}

/** Reveals text once the block enters the viewport. No styling of its own. */
export function CodeTyping({
  speed = 30,
  multiline = false,
  delay = 0,
  text = '',
  className = '',
}: CodeTypingProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [display, setDisplay] = useState('')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      const id = window.setTimeout(() => setIsVisible(true), 0)
      return () => window.clearTimeout(id)
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const lines = useMemo(() => {
    if (!multiline) return [text]
    return text
      .replace(/<br\s*\/?>/gi, '\n')
      .split(/\n+/)
      .map((line) => line.trim())
  }, [text, multiline])

  useEffect(() => {
    if (!isVisible || !text) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const charsPerMs = speed / 1000
    const timeouts: number[] = []
    if (reduce) {
      timeouts.push(window.setTimeout(() => setDisplay(lines.join('\n')), 0))
      return () => timeouts.forEach((id) => window.clearTimeout(id))
    }

    timeouts.push(
      window.setTimeout(() => {
        setDisplay('')
        let lineIndex = 0
        let charIndex = 0
        function step() {
          const currentLine = lines[lineIndex] ?? ''
          if (charIndex < currentLine.length) {
            const nextChar = currentLine.charAt(charIndex)
            if (nextChar) setDisplay((prev) => prev + nextChar)
            charIndex += 1
            timeouts.push(window.setTimeout(step, 1 / charsPerMs))
          } else if (multiline && lineIndex < lines.length - 1) {
            lineIndex += 1
            charIndex = 0
            setDisplay((prev) => prev + '\n')
            timeouts.push(window.setTimeout(step, 1 / charsPerMs))
          }
        }
        step()
      }, delay),
    )
    return () => {
      timeouts.forEach((id) => window.clearTimeout(id))
    }
  }, [isVisible, text, lines, speed, multiline, delay])

  return (
    <div ref={containerRef} className={className} style={{ whiteSpace: 'pre-wrap' }}>
      {display}
    </div>
  )
}
