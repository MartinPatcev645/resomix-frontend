import type { ReactNode } from 'react'

interface SideLinesProps {
  children?: ReactNode
  navbar?: ReactNode
  mode?: string
  className?: string
}

/** Dotted frame. Content is rendered once; the decorations differ by breakpoint. */
export function SideLines({ children, navbar, mode = 'home', className }: SideLinesProps) {
  return (
    <>
      <div className="hidden lg:block">
        <div className="absolute left-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1" />
        <div className="absolute right-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1" />
        <div className="absolute left-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1" />
        <div className="absolute right-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1" />
      </div>

      <div className="block lg:hidden">
        <div className="absolute left-0 top-[var(--px-24)] w-full border-t border-slate-200 border-dotted pointer-events-none z-1" />
        {(mode === 'about' || mode === 'upload') && (
          <div className="absolute left-0 top-[var(--px-716)] w-full border-t border-slate-200 border-dotted pointer-events-none z-1" />
        )}
      </div>

      <div
        className={
          className ??
          'mx-[var(--px-20)] lg:mx-[var(--px-63)] relative z-20 lg:z-auto h-full lg:h-auto min-h-screen lg:min-h-0 pt-[var(--px-28)] lg:pt-0'
        }
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60]">
          <div className="absolute left-0 top-0 bottom-0 border-l border-dotted border-slate-200" />
          <div className="absolute right-0 top-0 bottom-0 border-r border-dotted border-slate-200" />
        </div>

        <svg
          viewBox="0 0 1152 628"
          preserveAspectRatio="none"
          className="hidden lg:block absolute left-0 top-[var(--px-65)] w-full h-[length:var(--px-628)] pointer-events-none z-10"
        >
          <path
            d="M0.333008 1.07413H279.222L347.74 40.6333H779.963L848.481 1.07413H1152"
            stroke="#eceaeaff"
            strokeOpacity="1"
            strokeWidth="1"
            strokeDasharray="0.74 0.74"
            fill="none"
          />
        </svg>

        {navbar ? <header className="lg:hidden">{navbar}</header> : null}
        {children}
      </div>
    </>
  )
}
