// apps/<app>/lighthouserc.js
const path = require('path')

const FORM = (process.env.FORM_FACTOR || 'mobile').toLowerCase() // 'mobile' | 'desktop'
const BASE = process.env.BASE_URL || 'http://localhost:5173'

// write to repo root: reports/lhci-<form>-<app>/
const OUT = path.resolve(__dirname, `./reports/lhci-${FORM}-${path.basename(__dirname)}`)

const isDesktop = FORM === 'desktop'
const settings = {
  // IMPORTANT: formFactor and screenEmulation.mobile must agree
  // or Lighthouse will complain and/or behave like mobile. :contentReference[oaicite:0]{index=0}
  formFactor: isDesktop ? 'desktop' : 'mobile',
  screenEmulation: isDesktop
    ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
    : { mobile: true,  width: 360,  height: 640, deviceScaleFactor: 2.625, disabled: false },
  // throttlingMethod: 'simulate', // optional; leave default unless you want "provided"
}

/** @type {import('@lhci/cli').LHCIConfig} */
module.exports = {
  ci: {
    collect: {
      url: [`${BASE}/`],
      numberOfRuns: 1, // ← run once per form factor
      startServerCommand: 'pnpm preview --host --port 5173',
      startServerReadyPattern: 'Local:.*5173',
      settings, // ← pass our desktop/mobile settings
    },
    assert: {
      // Assert only scored categories & numeric audits (LHCI docs on assertions) :contentReference[oaicite:1]{index=1}
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:seo':           ['warn',  { minScore: 0.90 }],
        'categories:best-practices':['warn',  { minScore: 0.90 }],
        'categories:performance':   ['warn',  { minScore: 0.90 }],

        'errors-in-console': ['error', { maxLength: 0 }],          // no console errors
        'is-crawlable':      ['error', { minScore: 1 }],            // not blocked from indexing

        // numeric budgets (bytes) — see LHCI note re: bytes units :contentReference[oaicite:2]{index=2}
        'total-byte-weight':     ['warn',  { maxNumericValue: 1600000 }],
        'unused-javascript':     ['warn',  { maxNumericValue: 250000 }],
        'unminified-javascript': ['warn',  { maxNumericValue: 0 }],
        'uses-text-compression': ['warn',  { maxNumericValue: 0 }],

        // single-audit scores (scored audits only)
        'font-size':      ['warn', { minScore: 1 }],
        'color-contrast': ['warn', { minScore: 1 }]
      }
    },
    // Save reports to a predictable folder (filesystem target & outputDir) :contentReference[oaicite:3]{index=3}
    upload: { target: 'filesystem', outputDir: OUT }
  }
}
