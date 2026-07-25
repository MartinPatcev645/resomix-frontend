# Trionn Reference Analysis

Status: Draft proposal — awaiting approval
Repository: `/Users/astor/Documents/resomix-web`
Repository snapshot: `george-updates` at `2e00707`
Authority: Records what was directly observed on `https://trionn.com/` and separates observation from inference. Copyright boundary: reference for composition/interaction quality only — nothing is copied (see "What must not be copied").
Primary sources: live inspection of `https://trionn.com/` on 2026-07-22 via the user's Brave browser (Claude in Chrome extension)
Last reviewed: 2026-07-22

## 1. Inspection method

- **Live site**, user's Brave browser, driven through the Claude in Chrome extension; full homepage journey scrolled end-to-end with screenshots at each stage; menu overlay opened; runtime state inspected via in-page JavaScript (fonts, colours, scroll library, media elements).
- **Viewports inspected:** desktop window 1280×832 (viewport 1280×661), 1440×900 (1440×729), 1920×1080 (1568×681 effective), plus the narrowest achievable window (viewport 606×681) for responsive behaviour.
- **Limitations (disclosed):** (a) True 393px/430px mobile viewports were not reachable — Brave's minimum window width is ~606px; mobile observations below come from the 606px layout, which had already switched to its narrow/stacked mode. (b) The site pauses entirely (preloader, media, animation clock) while its window is occluded; early inspection attempts ran against a hidden window, and a small number of structural observations (DOM/library facts) were gathered in that state via scripted inspection, clearly separated below as runtime facts. (c) Sound-reactive behaviour ("SOUND ON") was not evaluated (muted session).
- **Observed vs inferred** is separated: §3 table = directly observed; §4 = inferred principles.

## 2. Runtime facts (from scripted inspection, not screenshots)

Lenis smooth scroll (`html.lenis`); body background `#040508`; typography stack loaded as webfont modules — a grotesk for editorial headings (computed h1: ~63px at 606w, weight 400, letter-spacing ≈ −6%, line-height ≈ 0.93), a serif display face (used in case-study imagery), and a monospace for micro-labels; six lazy-loaded `<video>` elements (services background, awards/team cards); one WebGL/canvas region (footer wordmark area); preloader overlay `div.pl-overlay` at z-index 9100; headline text splitting into per-character spans (reveal architecture); no scrollbar-jacking — wheel drives Lenis.

## 3. Evidence table (directly observed)

| Observed behavior | Desktop evidence | Mobile evidence (606px) | Principle worth adapting | What must not be copied |
|---|---|---|---|---|
| Preloader as designed moment: light-grey field, corner "+" registration marks, centred mark in hairline square, counter to 100, tri-word tagline | Screenshots of load sequence at 1280/1523w | Same pattern | Loading states can carry brand voice (deferred for Resomix — no content gating) | The grey field design, the mark, the tagline |
| Hero: near-black field; H1 top-left ("Designed to mean something."); mono CTA underline ("START A PROJECT →"); dimensional dark 3D letterform centre-right with subtle orange edge light; fine diagonal trajectory lines with node points; corner info islands (EST. badge, blurb, hold/dare affordance, progress circle) | 1280/1440/1920 hero captures | Stacked: H1 → CTA → object (smaller) → info island below | Asymmetric editorial hero; one dimensional brand object; far-apart info islands; instrument-style affordance labels | The letterform object; the exact island contents; slogans |
| Headline word morph with blur-to-focus ("mean something." → "mean impact.") | Two hero captures 6s apart showing mid-blur state | Not re-verified | Blur-to-focus as a resolution metaphor (Resomix: approved for Home Phase 2 only) | The specific morphing copy |
| Scroll-scrubbed paragraph: giant editorial paragraph brightens word-by-word as you scroll; tiny "ABOUT" margin label; 3D shards parallax gently behind | About-section captures at successive scroll positions | Same, stacked, object persists smaller | Typography as the section; scrubbed emphasis for long claims; micro-labels in margins | The paragraph text; shard models |
| Oversized marquee band "IMPACT + INSPIRE + INNOVATE" crossing both viewport edges, moving with scroll, 3D object centred behind; micro-labels above/below | Marquee captures at two positions | Marquee retained, scaled | Oversized kinetic type as a section divider (Resomix: contained/optional) | The three words; pairing with their mark |
| Light↔dark inversion via horizontal slat transition (light section slides in as bars over the dark field) | Slat-transition captures (dark→light before "Key facts", light→dark after gallery) | Present | Theme inversion as a dramatic, deliberate moment (maps to Resomix `.light` tokens) | The exact slat choreography |
| Light section: centred "Key facts" + three stat cards animating from skewed to flat (50+/1.5K+/20+) | Key-facts captures | Stacked cards | Inversion sections for factual/credibility content | Their stats, card art (lion imagery) |
| Partner logo strip on light field; hairline rules with "+"/"×" marks | Logo-strip capture | — | Hairline + registration-mark structural vocabulary (Resomix already owns dotted lines — extend, don't replace) | Their partner logos |
| Work gallery: vertical scroll drives horizontal card travel ("Selected work & explorations", cards MyWorker AI → Pulse Studio → Loftloom with mono "EXPLORE PROJECT →" links) | Sequential captures showing cards translating left | Cards stack vertically | Scroll-linked reveal of a collection (Resomix: out of scope for P1 informational pages) | Their case studies/images; the takeover pattern itself |
| Services sequence: pinned stacked words "A.I. / DESIGN / DEVELOPMENT / BRANDING"; background video darkens (smoke); words scatter into letters orbiting a 3D rock; letters imprint as carved mark; services list rotates through with thin-line concentric/arc icons | Six sequential captures of the full sequence | Not re-verified | One bounded, pinned narrative sequence per page maximum; letters→object as "capabilities become product" metaphor (Resomix equivalent: signal→intelligence, non-3D in P1) | The rock/asteroid, smoke video, carving choreography |
| Blur-to-focus section resolve: "DESIGN IN MOTION" + curved 3D carousel of shots sharpening from blur | Blur and resolved captures | — | Focus-resolution as section entrance (sparingly) | The dribbble carousel |
| Client stories: calm list of client names left, large quote right, mono "▷ LISTEN TO HIM!", square prev/next, "BECOME A CLIENT →" | Testimonial captures | — | Calm register for trust content (Resomix `/trust`, testimonials-when-they-exist) | Their quotes/clients |
| Footer: dark; "Ready to build something bold?"; mono CTA; local-time label "IST → 05:09"; enquiry/social columns; giant wordmark drawn as clusters of horizontal hairlines; "SOUND ON — HOVER THE LINES" affordance | Footer captures | — | Terminal-flavoured footer with live micro-data (Resomix already has this — keep); wordmark-as-lines is out (sound-reactive rejected P1) | The line-cluster wordmark; sound interaction |
| Menu: right-side white panel; four oversized links (Work/Services/About/Contact); enquiry + social; "✦ THE TRIONN NAME STORY" pill; MENU pill → MENU × | Menu-open capture | Hamburger-only header at 606px | Oversized-link menu panel (Resomix: evaluate against existing full-screen MenuPage in nav redesign) | Panel chrome, pill styles |
| Header: fixed minimal — logo left; sound toggle, "LET'S TALK" filled pill, "MENU" outlined pill right | All captures | Logo + hamburger only | Minimal fixed header with one primary CTA (matches revised Resomix header: one persistent CTA) | Pill styling, labels |
| Performance/loading behaviour: site fully pauses when occluded; media lazy-loads; long initial load behind preloader | Hidden-window inspection + load sequence | — | Respect device resources; but never gate content behind a mandatory loader (Resomix requirement) | — |

## 4. Inferred design principles (interpretation, not observation)

1. One narrative spine per page, carried by a single evolving object.
2. Typography *is* the interface: sections are typographic events; boxes/cards are rare.
3. Information islands: small mono-labelled clusters at extreme positions, connected by implied trajectories.
4. Motion resolves content (blur→focus, draw, illuminate, imprint) rather than looping; almost everything animates exactly once.
5. Darkness is home; light sections are punctuation.
6. Affordances are written, not implied ("HOLD TO…", "SOUND ON…") — instrument-panel language.
7. Scale contrast (giant type ↔ tiny labels) replaces colour variety; a single accent does the rest.
8. The 3D object earns its cost by *being the argument* (capabilities literally carve into the product), not by decorating.

## 5. Elements explicitly rejected for Resomix

Trionn branding/letterform and any derivative 3D object; rock/asteroid/smoke sequence; slogans and copy; source code, GLSL, assets, fonts (Resomix keeps Helvetica Neue / Fira Code / Benzin); preloader content-gating; sound-reactive footer/lines; scroll-driven horizontal work-gallery takeover (P1 scope); light-grey default fields (Resomix stays dark-first); exact section arrangement; button/menu/pill chrome; cursor-hold "blast" gimmick (no purpose in an informational site).

## Open decisions

- Whether the pinned-sequence budget (one per page, bounded) is acceptable — DESIGN_SYSTEM §44.22.

## Required confirmations

- User confirmation that this observation record is an acceptable basis for the direction (mobile-viewport limitation acknowledged).

## Change history

- 2026-07-22 — Initial version from the live study. Author: Claude.
