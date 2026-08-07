/* eslint-disable react-refresh/only-export-components */
import React from 'react';

type GlyphProps = React.SVGProps<SVGSVGElement>;

function GlyphBase({ children, ...rest }: GlyphProps) {
  return (
    <svg
      className="nav-mm-glyph"
      viewBox="0 0 18 18"
      aria-hidden="true"
      shapeRendering="geometricPrecision"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const NAV_GLYPHS = {
  'sonic-discovery': (
    <GlyphBase>
      <path d="M1.5 9v0M3.5 6.5v5M5.5 4.5v9M7.5 7v4" />
      <path d="M9.5 9h3.5m0 0-1.5-1.5M13 9l-1.5 1.5" />
      <path d="M15 5.5h1.5M15 9h1.5M15 12.5h1.5" />
    </GlyphBase>
  ),
  'track-intelligence': (
    <GlyphBase>
      <path d="M3 5.5h12M2 9h14M4 12.5h10" />
      <circle cx="6" cy="5.5" r="1" />
      <circle cx="12" cy="9" r="1" />
      <circle cx="8" cy="12.5" r="1" />
    </GlyphBase>
  ),
  'catalogue-intelligence': (
    <GlyphBase>
      <circle cx="4.5" cy="4.5" r="1.5" />
      <circle cx="13.5" cy="6" r="1.5" />
      <circle cx="6.5" cy="13" r="1.5" />
      <circle cx="13" cy="13.5" r="1" />
      <path d="M6 5.5l6 0.5M5.5 6.5l1 5M8 12.5l4 0.5M12.5 7.5l0.5 4" />
    </GlyphBase>
  ),
  'record-labels': (
    <GlyphBase>
      <rect x="3" y="11" width="12" height="3.5" rx="0.5" />
      <rect x="4" y="7" width="10" height="3" rx="0.5" />
      <rect x="5" y="3.5" width="8" height="2.5" rx="0.5" />
    </GlyphBase>
  ),
  'music-publishers': (
    <GlyphBase>
      <path d="M4 2.5h7l3 3v10H4z" />
      <path d="M11 2.5v3h3" />
      <path d="M6.5 9h5M6.5 11.5h5" />
    </GlyphBase>
  ),
  'sync-agencies': (
    <GlyphBase>
      <rect x="2.5" y="4" width="5.5" height="4" rx="0.5" />
      <path d="M8 6h3m0 0-1.5-1.5M11 6 9.5 7.5" />
      <path d="M12.5 4.5h3M12.5 7h3M12.5 9.5h3M12.5 12h3" />
      <path d="M2.5 11.5h5.5M2.5 14h4" />
    </GlyphBase>
  ),
  'music-libraries': (
    <GlyphBase>
      <rect x="2.5" y="5" width="13" height="9.5" rx="0.5" />
      <path d="M2.5 8h13" />
      <path d="M5.5 5V3h3v2M10 8v2h3V8" />
    </GlyphBase>
  ),
  'music-curators': (
    <GlyphBase>
      <circle cx="4" cy="4.5" r="1" />
      <circle cx="4" cy="9" r="1" />
      <circle cx="4" cy="13.5" r="1" />
      <path d="M7 4.5h8M7 9h8M7 13.5h5.5" />
    </GlyphBase>
  ),
  producers: (
    <GlyphBase>
      <rect x="2.5" y="3.5" width="6" height="3.5" rx="0.5" />
      <rect x="6.5" y="8" width="6" height="3.5" rx="0.5" />
      <rect x="9.5" y="12.5" width="6" height="2.5" rx="0.5" />
    </GlyphBase>
  ),
  'partner-overview': (
    <GlyphBase>
      <path d="M9 15V9M9 9 4 4.5M9 9l5-4.5" />
      <circle cx="4" cy="3.5" r="1" />
      <circle cx="14" cy="3.5" r="1" />
      <circle cx="9" cy="15.5" r="1" />
    </GlyphBase>
  ),
  pilot: (
    <GlyphBase>
      <path d="M3 3.5v11h12" />
      <path d="M3 11l3.5-3 3 2 4.5-4.5" />
      <path d="M12 5.5h2v2" />
    </GlyphBase>
  ),
  contact: (
    <GlyphBase>
      <rect x="2.5" y="4" width="13" height="9" rx="0.5" />
      <path d="M2.5 5.5 9 10l6.5-4.5" />
    </GlyphBase>
  ),
  trust: (
    <GlyphBase>
      <rect x="3" y="2.5" width="12" height="13" rx="0.5" />
      <path d="M6 6h6M6 9h6M6 12h3.5" />
    </GlyphBase>
  ),
  // Company group glyphs.
  about: (
    <GlyphBase>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 8v4.5" />
      <path d="M9 5.6v.9" />
    </GlyphBase>
  ),
  journal: (
    <GlyphBase>
      <path d="M3 3.5h5.5a2 2 0 0 1 2 2v9a1.6 1.6 0 0 0-1.6-1.2H3z" />
      <path d="M15 3.5H9.5a2 2 0 0 0-2 2v9a1.6 1.6 0 0 1 1.6-1.2H15z" />
    </GlyphBase>
  ),
  help: (
    <GlyphBase>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M6.9 7.1a2.1 2.1 0 1 1 2.6 2.4v1.2" />
      <path d="M9.5 12.8h.01" />
    </GlyphBase>
  ),
  legal: (
    <GlyphBase>
      <path d="M4 5.5h7l3 3v8H4z" />
      <path d="M10.5 5.5v3.2H14" />
      <path d="M6.5 11h5M6.5 13.5h3" />
    </GlyphBase>
  ),
  'code-brackets': (
    <GlyphBase>
      <path d="M6.5 5 3 9l3.5 4M11.5 5 15 9l-3.5 4" />
    </GlyphBase>
  ),
  'integration-planning': (
    <GlyphBase>
      <circle cx="4" cy="14" r="1.5" />
      <circle cx="14" cy="4" r="1.5" />
      <path d="M5.5 13c2-1 2.5-3.5 4-5s3-2.5 4-3" strokeDasharray="2 2" />
    </GlyphBase>
  ),
  'api-reference': (
    <GlyphBase>
      <path d="M4 2.5h7l3 3v10H4z" />
      <path d="M11 2.5v3h3" />
      <path d="M7 9.5 6 10.5 7 12M10.5 9.5l1 1.5-1 1.5" />
    </GlyphBase>
  ),
  'catalogue-ingestion': (
    <GlyphBase>
      <path d="M9 2.5v7m0 0L6.5 7M9 9.5 11.5 7" />
      <rect x="3" y="11" width="12" height="4.5" rx="0.5" />
    </GlyphBase>
  ),
  'analysis-schema': (
    <GlyphBase>
      <path d="M4.5 3v12" />
      <path d="M4.5 5.5h4M4.5 9h6.5M4.5 12.5h5" />
      <circle cx="10" cy="5.5" r="1" />
      <circle cx="12.5" cy="9" r="1" />
      <circle cx="11" cy="12.5" r="1" />
    </GlyphBase>
  ),
  'request-api': (
    <GlyphBase>
      <path d="M3 9h8m0 0L8.5 6.5M11 9l-2.5 2.5" />
      <path d="M13.5 3.5H15v11h-1.5" />
    </GlyphBase>
  ),
} as const;

export type NavGlyphKey = keyof typeof NAV_GLYPHS;
