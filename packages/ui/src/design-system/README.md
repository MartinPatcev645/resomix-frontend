# Resomix UI System

Phase 1B precision-industrial foundation for internal Resomix workspace review.

## Isolation contract

- CSS variables: `--rx-*`
- classes: `rx-*`
- React components: `Rx*`
- styles activate only inside `[data-rx-ui]`
- no production route migration in Phase 1

## Design thesis

Underground electronic-music workstation with audio-hardware precision — not rounded consumer SaaS, not chaotic anti-design.

## Geometry tokens

| Token | Value | Use |
|---|---|---|
| `--rx-radius-panel` | `0` | frames, racks, channels, result rows |
| `--rx-radius-control` | `2px` | buttons, fields, artwork |
| `--rx-radius-tag` | `2px` | badges / status chips |
| `--rx-radius-circle` | `999px` | profile/identity avatars only — not play/pause or overflow |
| `--rx-notch-md` | `10px` | desktop major chamfers |
| `--rx-notch-sm` | `6px` | mobile / small chamfers |

## Chamfers

Limited signature uses:

- selected product-mode card
- primary button
- upload drop zone
- playing reference strip

Focus rings stay rectangular: chamfered controls drop `clip-path` on `:focus-visible`.

## Colour / border roles

- canvas `#050505`
- surface `#111111` / raised `#171717`
- subtle / default / strong borders at ~9% / 16% / 24% white
- accent `#EE4A26` reserved for selected, playing, primary action, drag-active / focus upload feedback
- score rails idle: neutral silver fill; orange only for selected/playing emphasis

## State model

default · hover · focus-visible · selected · playing · paused · loading · disabled · unavailable · error

Selected and playing use a left rail marker plus restrained tint — not a full orange outline shared with hover/focus.

## Components

- `RxButton` — primary (block + small chamfer), secondary (wireframe), ghost (underline edge)
- `RxIconButton` — square hardware control (`2px`); optional `rx-icon-button--circle` only for identity avatars, not transport
- `RxBadge` — sharp tag, not pill
- `RxModeSelector` — instrument cards with `ACTIVE TASK` + left orange rail when selected
- `RxTabs` — rectangular bay tabs with orange lower rail when active
- `RxSearchField` — input bay + chamfered upload zone with corner ticks; upload states: default / drag-active / focus / error
- `RxScoreRail` — squared precision meter with tick overlay; exact percentage width
- `RxTrackResultRow` — channel-strip cell; group inside `.rx-channel`
  - playing: strongest orange
  - selected: restrained orange tint + left rail
  - paused: quiet neutral marker (not identical to playing)
  - unavailable: subdued
- `RxReferenceStrip` — square rack channel, 56px target
- `RxSidebarItem` — active left rail

## Contrast (Phase 1B polish)

Token `--rx-color-text-muted`: `rgba(255,255,255,0.72)` (computed). Alpha-composited WCAG ratios:

| Surface | Solid FG | Ratio |
|---|---|---|
| `#111111` surface | `rgb(188,188,188)` | **9.94:1** |
| `#050505` canvas | `rgb(185,185,185)` | **10.39:1** |
| `#0A0A0A` input field | `rgb(186,186,186)` | **10.20:1** |
| default dropzone (0.02 white over surface) | `rgb(190,190,190)` | **9.74:1** |
| drag-active/focus (accent-soft over surface) | `rgb(197,191,189)` | **9.07:1** |
| error dropzone over surface | `rgb(194,191,190)` | **9.37:1** |

All exceed WCAG AA 4.5:1 for small metadata / upload constraints.

## Specimen markup adjustments (Phase 1B)

- `.rx-system-frame.rx-ticks` wraps the specimen body (major system frame + corner ticks)
- `.rx-section-head` / `.rx-section-index` add technical section indexing
- `.rx-channel` groups desktop and mobile result rows into one continuous strip
- `.rx-rack.rx-ticks` frames the foundations colour rack
- `uploadState` prop on `RxSearchField` for drop-zone visual states
- mode badge copy: `Active task` / `Available`

## Adoption

Import from `@resomix/ui`, render inside `[data-rx-ui]`, pass data and callbacks through props. Do not import stores, APIs, playback, auth, or analytics into these components.
