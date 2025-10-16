# Webapp HTML/CSS Accessibility Audit

## Executive Summary

This document audits all files used in the `/` (upload) and `/playlist` routes for HTML/CSS/accessibility best practices. All suggested changes maintain the exact visual appearance while improving semantics and accessibility.

---

## Global Issues

### index.html
**File:** `apps/webapp/index.html`

✅ **Correct:**
- Has `<!DOCTYPE html>`
- Has `lang="en"` on `<html>`
- Has `<meta charset="UTF-8">`
- Has `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- Has meaningful `<title>` and `<meta name="description">`

✅ **No issues found** - Global HTML structure is correct.

---

## Pages

### UploadPage.tsx (Desktop)
**File:** `apps/webapp/src/pages/desktop/UploadPage.tsx`

**Issues:**

1. **Missing semantic structure** (Line 64-94)
   - Problem: Uses generic `<div>` for entire page structure
   - Fix: Add `<main>` wrapper for primary content
   - Impact: Screen readers can't identify main content region

2. **Navigation uses onClick without semantic element** (Lines 81-87)
   - Problem: Navbar should use `<header>` landmark
   - Fix: While Navbar component is from @resomix/ui, ensure it renders proper `<nav>` inside `<header>`
   - Impact: Screen readers can't identify site navigation

**Suggested changes:**
```tsx
// Wrap main content in <main> tag
<main>
  <SideLines>
    <Navbar ... />
    <UploadHero />
    <UploadOne />
  </SideLines>
</main>
```

---

### UploadMobile.tsx (Mobile)
**File:** `apps/webapp/src/pages/mobile/UploadMobile.tsx`

**Issues:**

1. **Missing `<main>` landmark** (Lines 67-96)
   - Problem: No `<main>` wrapper for primary content
   - Fix: Wrap SideLines content in `<main>`
   - Impact: Screen readers can't identify main content

2. **Generic div with background color** (Line 74)
   - Problem: Using inline styles for presentational purposes is fine, but page structure should use semantic HTML
   - Fix: Ensure parent div is `<main>` or appropriate landmark

---

### PlaylistPage.tsx (Desktop)
**File:** `apps/webapp/src/pages/desktop/PlaylistPage.tsx`

**Issues:**

1. **Missing `<main>` landmark** (Lines 63-94)
   - Problem: No `<main>` tag wrapping primary content
   - Fix: Add `<main>` wrapper around content div
   - Impact: Screen readers can't identify main content region

**Suggested changes:**
```tsx
<div className="bg-[var(--color-secondary)]">
  <StaticNoise />
  <main style={{ margin: '0 auto', ... }}>
    <SideLines>
      <Navbar ... />
      <PlaylistHero />
      <PlaylistTable />
      <GlobalFooter ... />
    </SideLines>
  </main>
</div>
```

---

### PlaylistMobile.tsx (Mobile)
**File:** `apps/webapp/src/pages/mobile/PlaylistMobile.tsx`

**Issues:**

1. **Missing `<main>` landmark** (Lines 88-116)
   - Problem: No `<main>` wrapper for primary content
   - Fix: Wrap SideLines in `<main>`
   - Impact: Screen readers can't identify main content

---

## Sections

### sections/desktop/Upload/UploadHero.tsx

**Issues:**

1. **Decorative text treated as content** (Lines 44-106)
   - Problem: Code-styled animated text is presentational but no clear semantic separation
   - Fix: This is acceptable as is - the content provides context
   - Impact: None - content is meaningful

2. **SVG lacks accessibility attributes** (Lines 12-32)
   - Problem: SVG clipPath frame is decorative but not marked as such
   - Fix: Add `aria-hidden="true"` to the SVG
   - Impact: Screen readers will read unnecessary SVG markup

**Suggested changes:**
```tsx
<svg
  viewBox="0 0 1152 628"
  preserveAspectRatio="none"
  className="absolute inset-0 w-full h-[length:var(--px-628)] pointer-events-none z-10"
  aria-hidden="true"  // ADD THIS
>
```

3. **Image alt text** (Lines 85, 91, 112)
   - Problem: Images have `aria-hidden="true"` AND `alt` text - choose one
   - Fix: Remove `alt` attribute when using `aria-hidden="true"` OR remove `aria-hidden` and keep meaningful alt
   - Impact: Conflicting accessibility hints

**Suggested changes:**
```tsx
// Line 85 - This is decorative, keep aria-hidden, remove alt
<img className="w-[var(--px-35)] h-[var(--px-35)]" draggable={false} src={ArrowSmallDown} aria-hidden="true" loading="lazy" alt="" />

// Line 91 - decorative
<img src={LineThree} className="w-[var(--px-4)] h-[var(--px-60)]" draggable={false} aria-hidden="true" loading="lazy" alt="" />

// Line 112 - decorative  
<img src={AngleDown} draggable={false} className="w-[var(--px-55)] h-[var(--px-44)]" aria-hidden="true" loading="lazy" alt="" />
```

---

### sections/desktop/Upload/UploadOne.tsx

**Issues:**

1. **Form controls missing `<form>` wrapper** (Lines 35-72)
   - Problem: Results count dropdown is a form control but not wrapped in `<form>`
   - Fix: Acceptable as is - it's a standalone control, not a submitted form
   - Impact: None - single controls don't require `<form>`

2. **Label not properly associated with select** (Lines 56-70)
   - Problem: "Results Count" text is not a `<label>` element
   - Fix: Use `<label htmlFor="upload-results-count-select">` instead of div
   - Impact: Clicking label won't focus the select

**Suggested changes:**
```tsx
<Tooltip message="...">
  <div className="flex items-center gap-[var(--px-6)] hover:cursor-pointer">
    <label 
      htmlFor="upload-results-count-select"
      className="text-[length:var(--px-9)] font-fira font-light mt-[var(--px-1)]"
    >
      Results Count
    </label>
    <div>
      <img src={InfoSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-10)] h-[var(--px-10)]" />
    </div>
  </div>
</Tooltip>
```

---

### sections/mobile/Upload/UploadHero.tsx

**Issues:**

1. **Headings structure missing** (Line 23)
   - Problem: Large text "Here's where the journey begins" should be an `<h1>`
   - Fix: Wrap in `<h1>` tag
   - Impact: Page has no heading hierarchy

**Suggested changes:**
```tsx
<h1 className="text-[length:var(--px-49)] font-helvetica leading-[var(--px-50)] font-bold uppercase">
  Here's<br />where<br />the journey<br /><span className="italic">begins</span>
</h1>
```

2. **Social media links use onClick instead of `<a>`** (Lines 36-56)
   - Problem: IconComp with onClick for external navigation should be `<a>` tags
   - Fix: Wrap IconComp in `<a>` or ensure IconComp renders as `<a>` when given a URL
   - Impact: Not keyboard accessible, not recognized as links

**Suggested changes:**
```tsx
<a 
  href={FACEBOOK_URL} 
  target="_blank" 
  rel="noopener noreferrer"
  aria-label="Visit Resomix on Facebook"
  className="w-[var(--px-23)] h-[var(--px-23)] social-icon"
  id="upload-hero-facebook-icon"
>
  <img className="w-[var(--px-23)] h-[var(--px-23)]" draggable={false} src={FbSvg} alt="" />
</a>
```

3. **Images with aria-label AND alt** (Lines 37, 44, 51)
   - Problem: Using both `aria-label` and `alt` is redundant
   - Fix: Remove `aria-label`, keep `alt`, or remove `alt` if using `aria-label` on parent
   - Impact: Screen readers get duplicate announcements

---

### sections/mobile/Upload/UploadOne.tsx

**Issues:**

1. **Headings missing** (Lines 37-42)
   - Problem: "Set Your Depth" should be a heading (probably `<h2>`)
   - Fix: Wrap in `<h2>` tag
   - Impact: No content hierarchy

**Suggested changes:**
```tsx
<h2 className="text-[length:var(--px-18)] font-semibold font-helvetica uppercase">
  Set Your Depth
</h2>
```

2. **SVG inline without accessibility** (Lines 66-79)
   - Problem: Inline SVG arrow icon not marked as decorative
   - Fix: Add `aria-hidden="true"` to SVG
   - Impact: Screen reader reads SVG code

**Suggested changes:**
```tsx
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 52 53"
  className="w-[var(--px-10)] h-[var(--px-10)] pointer-events-none"
  fill="none"
  aria-hidden="true"  // ADD THIS
>
```

3. **Label not properly associated** (Lines 82-89)
   - Problem: "Results Count" text is not a `<label>` 
   - Fix: Use `<label htmlFor="upload-results-count-select">`
   - Impact: Clicking text won't focus select

---

### sections/desktop/Playlist/PlaylistHero.tsx

**Issues:**

1. **Missing heading hierarchy** (Lines 185-194)
   - Problem: Playlist name (large text) should be `<h1>`
   - Fix: Wrap HoverFlow text in `<h1>` or make HoverFlow render as h1
   - Impact: Page has no main heading

**Suggested changes:**
```tsx
<h1 className="text-[length:var(--px-19)] font-light uppercase font-helvetica leading-[var(--px-24)]">
  <HoverFlow
    text={playlistData?.playlist.name || "No playlist data"}
    maxChars={35}
    delay={800}
    speed={80}
    endPause={1000}
    maxWidth="400px"
  />
</h1>
```

2. **Links use onClick instead of `<a>`** (Line 105)
   - Problem: "Generate track similarity" link uses onClick on div
   - Fix: Use `<a>` tag with href
   - Impact: Not keyboard accessible, not recognized as link by screen readers

**Suggested changes:**
```tsx
<a 
  href={BASE_BETA_URL}
  className="flex text-[length:var(--px-9)] font-light font-fira gap-[var(--px-8)] items-center hover:underline playlist-nav-link" 
  id="playlist-hero-back-link"
>
  <img src={AngleLeftSvg} alt="" aria-hidden="true" draggable={false} className="w-[var(--px-13)] h-[var(--px-13)]" />
  Generate track similarity
</a>
```

3. **Images used as buttons** (Line 167)
   - Problem: Click handler on image for rating - should be `<button>`
   - Fix: Wrap in `<button type="button">`
   - Impact: Not keyboard accessible

**Suggested changes:**
```tsx
<button 
  type="button"
  onClick={() => setShowRating(true)} 
  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] p-[var(--px-10)] flex gap-[var(--px-8)] items-end cursor-pointer playlist-rating-button" 
  id="playlist-hero-rating-button"
  aria-label="Rate this playlist"
>
  <img src={StarSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-12)] h-[var(--px-12)] mb-[var(--px-2)]" />
  <span className="text-[length:var(--px-8)] tracking-[var(--px-0-25)] font-light font-fira text-[var(--color-text-primary)]">Rate This Playlist</span>
</button>
```

4. **Toggle button for meta info** (Line 216)
   - Problem: Image with onClick - should be `<button>`
   - Fix: Already has proper structure but missing button wrapper
   - Impact: Not fully keyboard accessible

**Suggested changes:**
```tsx
<button
  type="button"
  onClick={() => setShowMeta((v) => !v)} 
  aria-label={showMeta ? "Hide Meta Info" : "Show Meta Info"}
  aria-expanded={showMeta}
  className="hover:cursor-pointer playlist-meta-toggle" 
  id="playlist-hero-meta-toggle"
>
  <img draggable={false} src={InfoSvg} alt="" aria-hidden="true" className="w-[var(--px-14)] h-[var(--px-14)] ml-[var(--px-20)]" />
</button>
```

---

### sections/desktop/Playlist/PlaylistTable.tsx

**Issues:**

1. **Table semantics missing** (Lines 40-152)
   - Problem: Using divs to create table-like layout
   - Fix: Consider using actual `<table>` with proper semantics OR add ARIA roles
   - Impact: Screen readers can't navigate as table

**Note:** Converting to real table might change layout behavior. If keeping div-based:

**Suggested changes:**
```tsx
<div className="flex flex-col items-center justify-center ..." role="table" aria-label="Similar tracks">
  {/* Header */}
  <div className="flex tracking-[var(--px-0-1)] ..." role="row">
    <div role="columnheader">#</div>
    <div role="columnheader">Artist</div>
    <div role="columnheader">Title</div>
    {/* ... */}
  </div>
  {/* Table */}
  {tracks.map((track) => (
    <div key={track.id} className="w-full border ..." role="row">
      {/* cells use role="cell" */}
    </div>
  ))}
</div>
```

2. **Missing heading for table section** (Line 41)
   - Problem: No `<h2>` or heading for "similar tracks" section
   - Fix: Add visually-hidden or visible heading
   - Impact: Screen readers can't identify section purpose

**Suggested changes:**
```tsx
<div className="flex flex-col items-center justify-center -mt-[var(--px-30)] w-[var(--px-763)] ml-[var(--px-230)] gap-[var(--px-10)]">
  <h2 className="sr-only">Similar Tracks</h2>  {/* or visible */}
  {/* Header row */}
```

---

### sections/mobile/Playlist/PlaylistHero.tsx

**Issues:**

1. **Missing `<h1>` for playlist name** (Lines 135-143)
   - Problem: Playlist name should be in `<h1>`
   - Fix: Wrap in heading tag
   - Impact: No page heading

2. **Navigation link uses onClick** (Line 71)
   - Problem: Back navigation uses onClick instead of `<a>`
   - Fix: Convert to anchor tag
   - Impact: Not keyboard accessible

**Suggested changes:**
```tsx
<a 
  href={BASE_BETA_URL}
  className="flex items-center cursor-pointer ml-[var(--px-10)] playlist-nav-link" 
  id="playlist-hero-back-link"
  aria-label="Back to upload"
>
  <img src={AngleLeftSvg} alt="" aria-hidden="true" draggable={false} className="w-[var(--px-30)] h-[var(--px-30)]" />
</a>
```

3. **Image as button for info toggle** (Line 163)
   - Problem: onClick on img - should be button
   - Fix: Wrap in button element
   - Impact: Not keyboard accessible

4. **Image as button for more menu** (Lines 184-193)
   - Problem: div with onClick containing img
   - Fix: Use `<button>` element
   - Impact: Not keyboard accessible

**Suggested changes:**
```tsx
<button
  type="button"
  onClick={() => onMoreClick?.(...)}
  className="cursor-pointer playlist-more-button absolute right-[var(--px-16)] top-[var(--px-16)]" 
  id={`playlist-hero-more-${playlistData?.queried_track.id || ''}`}
  aria-label="More options"
>
  <img src={MoreSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-19)] h-[var(--px-14)]" />
</button>
```

---

### sections/mobile/Playlist/PlaylistTable.tsx

**Issues:**

1. **Missing heading** (Line 27)
   - Problem: No `<h2>` for tracks section
   - Fix: Add heading (can be visually hidden)
   - Impact: No section identification

2. **Div-based table without ARIA** (Lines 28-116)
   - Problem: Table-like structure using divs
   - Fix: Add ARIA table roles OR use actual `<table>`
   - Impact: Screen readers can't navigate as table

3. **Clickable div instead of button** (Lines 32-96)
   - Problem: Play/pause on div with onClick
   - Fix: Wrap in `<button type="button">`
   - Impact: Not keyboard accessible

**Suggested changes:**
```tsx
<button
  type="button"
  onClick={() => handlePlayPause(track.id)}
  className="flex items-center gap-[var(--px-7)] w-full playlist-play-button" 
  id={`playlist-table-play-button-${track.id}`}
  aria-label={`${currentTrackId === track.id && isPlaying ? 'Pause' : 'Play'} ${track.title} by ${track.artist}`}
>
  {/* track content */}
</button>
```

4. **More button is div** (Lines 103-111)
   - Problem: div with onClick for more options
   - Fix: Use button element
   - Impact: Not keyboard accessible

---

### sections/mobile/Playlist/MoreMenu.tsx

**Issues:**

1. **Missing heading** (Line 80)
   - Problem: Track name should be in heading tag
   - Fix: Use `<h2>` or `<h1>`
   - Impact: No heading hierarchy

**Suggested changes:**
```tsx
<h2 className="text-[length:var(--px-22)] font-light uppercase font-helvetica text-center w-[var(--px-300)] truncate">
  <HoverFlow
    text={name ?? ''}
    maxChars={23}
    delay={800}
    speed={80}
    endPause={1000}
    maxWidth="300px"
  />
</h2>
```

2. **Description list would be better** (Lines 93-186)
   - Problem: Info pairs (Label/Duration/etc.) displayed as divs
   - Fix: Use `<dl>`, `<dt>`, `<dd>` for key-value pairs
   - Impact: Screen readers can't identify label-value relationships

**Suggested changes:**
```tsx
<dl className="flex flex-col gap-[var(--px-10)] w-full">
  <div className="flex w-full justify-between">
    <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Label:</dt>
    <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">
      {label && label.trim() !== '' ? label : '-'}
    </dd>
  </div>
  {/* repeat for other fields */}
</dl>
```

---

## Local Components

### components/upload/UploadLoader.tsx

**Issues:**

1. **Missing heading for loading state** (Line 81)
   - Problem: No heading to announce loading state
   - Fix: Add visually-hidden `<h1>` or `role="status"` with `aria-live`
   - Impact: Screen readers don't announce loading state clearly

**Suggested changes:**
```tsx
<div 
  className="w-screen h-screen relative overflow-hidden bg-[var(--color-primary-background)] lg:bg-[var(--color-secondary)] similarity-playlist-loader" 
  id="similarity-playlist-loader"
  role="status"
  aria-live="polite"
  aria-label="Loading playlist"
>
  <h1 className="sr-only">Loading Your Playlist</h1>
  {/* rest of content */}
</div>
```

2. **Decorative images missing alt=""** (Lines 133, 171, 196)
   - Problem: Images have aria-label but are decorative
   - Fix: Use `alt=""` and `aria-hidden="true"`
   - Impact: Screen readers read unnecessary descriptions

---

### components/upload/SearchComponent.tsx

**Issues:**

1. **Tab buttons should use proper ARIA** (Lines 59-72)
   - Problem: Tab-like interface using divs with onClick
   - Fix: Use `<button>` with ARIA tab pattern OR actual navigation
   - Impact: Not keyboard accessible, tabs not announced properly

**Suggested changes:**
```tsx
<div className="flex" role="tablist">
  <button
    role="tab"
    aria-selected="true"
    aria-controls="search-panel"
    type="button"
    className="flex-1/2 h-[var(--px-55)] p-3 flex items-center justify-center gap-2"
  >
    <span className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">SEARCH</span>
    <img src={searchIcon} alt="" aria-hidden="true" draggable={false} className="w-[var(--px-16)] h-[var(--px-16)]" />
  </button>
  <button
    role="tab"
    aria-selected="false"
    aria-controls="upload-panel"
    type="button"
    className="flex-1/2 h-[var(--px-55)] p-3 flex items-center justify-center gap-2 hover:cursor-pointer hover:underline search-component-upload-button"
    onClick={onUploadClick}
    id="search-component-upload-button"
  >
    <span className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">UPLOAD</span>
    <img src={uploadIcon} alt="" aria-hidden="true" draggable={false} className="w-[var(--px-16)] h-[var(--px-16)]" />
  </button>
</div>
```

2. **Heading missing** (Lines 116-122)
   - Problem: "Do you have a song in mind?" should be a heading
   - Fix: Use `<h2>` or `<h3>` depending on hierarchy
   - Impact: No content structure

3. **Label association issue** (Lines 78-86)
   - Problem: "Search Mode" text is not a `<label>`
   - Fix: Use proper label element
   - Impact: Clicking text won't focus select

---

### components/upload/UploadComponent.tsx

**Issues:**

1. **Tab pattern same as SearchComponent** (Lines 54-66)
   - Problem: Div with onClick instead of button
   - Fix: Use `<button>` with ARIA tablist pattern
   - Impact: Not keyboard accessible

2. **File input is hidden but accessible** (Lines 42-48)
   - Problem: None - this is correct pattern
   - ✅ Good: Hidden file input triggered by button

3. **Heading missing** (Line 74)
   - Problem: "Discover the Power of Deep Sonic Analysis" should be heading
   - Fix: Wrap in `<h2>`
   - Impact: No content hierarchy

**Suggested changes:**
```tsx
<h2 className="mt-[var(--px-10)] text-[length:var(--px-16)] font-helvetica font-light text-center leading-[var(--px-20)] uppercase">
  Discover the Power of<br />Deep Sonic Analysis
</h2>
```

---

### components/upload/PopularComponent.tsx

**Issues:**

1. **Missing heading** (Line 34)
   - Problem: "Beats Ready For You" should be a heading
   - Fix: Wrap in `<h2>` or `<h3>`
   - Impact: No section identification

**Suggested changes:**
```tsx
<h2 className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">
  Beats Ready For You
</h2>
```

2. **Clickable divs instead of buttons/links** (Lines 38-69)
   - Problem: Track selection uses div with onClick
   - Fix: Use `<button type="button">` for each track
   - Impact: Not keyboard accessible

**Suggested changes:**
```tsx
<button
  type="button"
  key={track.id}
  id={`popular-track-${track.id}`}
  className="group w-full h-[var(--px-53-5)] border border-dotted border-slate-200 my-auto flex justify-between items-center hover:cursor-pointer hover:bg-[var(--color-primary-hover)] transition-colors"
  onClick={() => onTrackSelect?.(track)}
  aria-label={`Play ${track.title} by ${track.artist}`}
>
  {/* content */}
</button>
```

---

### components/Playlist/InputPlayer.tsx

**Issues:**

1. **Volume slider missing label** (Lines 112-128)
   - Problem: Range input has no associated label
   - Fix: Add `aria-label` or visual label
   - Impact: Screen readers don't announce purpose

**Suggested changes:**
```tsx
<input
  type="range"
  min="0"
  max="1"
  step="0.01"
  value={volume}
  onChange={ctl.handleVolumeChange}
  aria-label="Volume"
  className="relative w-full h-[var(--px-2)] ..."
/>
```

2. **Time display should use `<time>` element** (Lines 133-135)
   - Problem: Time display uses span
   - Fix: Use `<time>` element with datetime attribute
   - Impact: Semantic clarity

**Suggested changes:**
```tsx
<time className="text-[length:var(--px-10)] lg:text-[length:var(--px-8)] text-right font-fira font-light">
  {formatTime(ctl.uiTime)} / {formatTime(totalDuration)}
</time>
```

3. **Network error icon uses inline styles** (Lines 136-151)
   - Problem: Complex mask styling - acceptable for icon rendering
   - ✅ This is fine for SVG masking

---

### components/Playlist/SimilarityPlayer.tsx

**Issues:**

Same as InputPlayer:
1. Volume slider missing label (Line 77-85)
2. Time display should use `<time>` (Line 89-91)

---

### components/Modals/PlaylistRating.tsx

**Issues:**

1. **Modal missing dialog semantics** (Lines 100-201)
   - Problem: div-based modal should use proper dialog
   - Fix: Use `<dialog>` element OR add `role="dialog"` with `aria-modal="true"`
   - Impact: Screen readers don't announce modal state

**Suggested changes:**
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="rating-dialog-title">
  <div
    className="absolute inset-0 bg-black/20 backdrop-blur-sm modal-backdrop"
    onClick={onClose}
    id="playlist-rating-backdrop"
    aria-hidden="true"
  />

  <div className="relative z-10 bg-[var(--color-secondary)] ...">
    <div className="text-center mb-[var(--px-24)] w-full">
      <h2 id="rating-dialog-title" className="text-[length:var(--px-19)] font-semibold uppercase font-helvetica leading-[var(--px-24)]">
        "Rate the similarity results of this playlist"
      </h2>
    </div>
    {/* rest */}
  </div>
</div>
```

2. **Textarea missing label** (Lines 187-193)
   - Problem: Textarea has placeholder but no associated label
   - Fix: Add `<label>` element (visible label exists at line 184-186, associate it)
   - Impact: Not properly labeled

**Suggested changes:**
```tsx
<div className="flex flex-col items-start gap-[var(--px-10)] w-full">
  <label htmlFor="rating-feedback" className="text-[length:var(--px-11)] font-medium leading-[var(--px-16)] font-fira">
    Share your experience <span className="text-[length:var(--px-10)] opacity-80 font-extralight">(optional)</span>
  </label>
  <textarea
    id="rating-feedback"
    className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-10)] font-light font-helvetica"
    rows={4}
    placeholder="Please describe your rating or feedback in detail..."
    value={feedback}
    onChange={(e) => setFeedback(e.target.value)}
  />
</div>
```

3. **Rating buttons missing proper state** (Lines 117-180)
   - Problem: divs used as radio buttons
   - Fix: Use actual radio buttons OR add proper ARIA roles
   - Impact: Screen readers can't identify as form controls

**Suggested changes:**
```tsx
<fieldset className='flex items-center w-full justify-evenly mb-[var(--px-10)]'>
  <legend className="sr-only">Rate the playlist</legend>
  
  <label
    className='flex flex-col items-center gap-[var(--px-10)] group cursor-pointer rating-option'
    id="playlist-rating-bad"
  >
    <input
      type="radio"
      name="playlist-rating"
      value="bad"
      checked={selectedRating === 'bad'}
      onChange={() => handleRatingSelect('bad')}
      className="sr-only"
    />
    <BadIcon
      className='w-[var(--px-45)] h-[var(--px-45)] transition-colors'
      selected={selectedRating === 'bad'}
      color={getIconColor('bad')}
    />
    <span className='text-[length:var(--px-9)] font-light leading-[var(--px-12)] font-fira text-[var(--color-primary)] group-hover:text-[var(--color-primary-hover)] transition-colors'>
      Bad
    </span>
  </label>
  {/* repeat for fine, good, fire */}
</fieldset>
```

---

### components/Modals/PlaylistShare.tsx

**Issues:**

1. **Modal missing dialog semantics** (Lines 176-210)
   - Same as PlaylistRating
   - Fix: Add `role="dialog"` and `aria-modal="true"`
   - Impact: Not announced as modal

2. **Clickable div for link** (Line 196)
   - Problem: div with onClick instead of button
   - Fix: Use `<button>` since it triggers copy action
   - Impact: Not keyboard accessible

**Suggested changes:**
```tsx
<button
  type="button"
  onClick={handlePrimaryAction}
  className='relative text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] w-full text-center cursor-pointer my-[var(--px-8)] share-link' 
  id="playlist-share-link"
>
  <img src={BrakesSvg} alt="" aria-hidden="true" loading="lazy" draggable={false} className="absolute top-0 left-0 pointer-events-none" />
  {link || 'Generating link...'}
</button>
```

---

### components/Modals/PlaylistRename.tsx

**Issues:**

1. **Modal missing dialog semantics** (Lines 96-126)
   - Same as other modals
   - Fix: Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
   - Impact: Not announced as modal

2. **Input missing label** (Lines 112-117)
   - Problem: Input has placeholder but no label
   - Fix: Associate with heading or add label
   - Impact: Not properly labeled

**Suggested changes:**
```tsx
<div className="text-center w-full">
  <h2 id="rename-dialog-title" className="text-[length:var(--px-19)] font-semibold uppercase font-helvetica leading-[var(--px-24)]">
    Rename Playlist
  </h2>
</div>
<div className="w-full">
  <label htmlFor="playlist-name-input" className="sr-only">New playlist name</label>
  <input
    id="playlist-name-input"
    className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-16)] lg:text-[length:var(--px-10)] font-light font-helvetica"
    placeholder="Type new playlist name..."
    value={newName}
    onChange={(e) => setNewName(e.target.value)}
  />
</div>
```

---

### pages/MenuPage.tsx

**Issues:**

1. **Close button missing button element** (Lines 22-29)
   - Problem: Uses bare onClick on img inside conditional
   - Fix: Ensure button wrapper is always used
   - Impact: Not keyboard accessible

**Suggested changes:**
```tsx
{onClose ? (
  <button type="button" onClick={onClose} aria-label="Close menu" className="bg-transparent border-none p-0">
    <img src={CrossSvg} alt="" aria-hidden="true" loading="lazy" draggable={false} className="w-[var(--px-19)] h-[var(--px-19)]" />
  </button>
) : (
  <a href={BASE_LANDING_URL} aria-label="Go to Resomix home" className="menu-home-link" id="beta-menu-home-link">
    <img src={CrossSvg} alt="" aria-hidden="true" loading="lazy" draggable={false} className="w-[var(--px-19)] h-[var(--px-19)]" />
  </a>
)}
```

2. **Menu items use div with onClick** (Lines 37-49)
   - Problem: Should use `<a>` for navigation or `<button>` for actions
   - Fix: Convert to appropriate semantic elements
   - Impact: Not keyboard accessible, not recognized as navigation

**Suggested changes:**
```tsx
<a 
  href={`${BASE_LANDING_URL}/about`}
  className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer menu-link" 
  id="beta-menu-about-link"
>
  [About Us]
</a>

<button 
  type="button"
  onClick={showFeedbackForm}
  className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer menu-link" 
  id="beta-menu-feedback-link"
>
  [Feedback]
</button>
```

3. **Missing nav landmark** (Lines 31-60)
   - Problem: Menu links should be in `<nav>`
   - Fix: Wrap menu items in `<nav>`
   - Impact: Screen readers can't identify as navigation

**Suggested changes:**
```tsx
<nav aria-label="Main menu">
  <div className="flex flex-col gap-[var(--px-30)] items-center">
    {/* menu items */}
  </div>
</nav>
```

4. **Missing heading** (Lines 62-65)
   - Problem: "Join the Resomix Universe" should be heading
   - Fix: Wrap in `<h2>` or appropriate level
   - Impact: No semantic structure

---

## @resomix/ui Components

### packages/ui/src/Layout/Navbar.tsx

**Issues:**

1. **Nav is properly wrapped** (Line 20)
   - ✅ Correctly uses `<nav>` element

2. **Links use window.location instead of anchor** (Lines 33-40)
   - Problem: Button onClick for navigation instead of `<a href>`
   - Fix: ButtonHeavyRight and ButtonHeavyLeft should render as `<a>` when navigating
   - Impact: Not recognized as links, breaks right-click context menu

**Note:** This requires updating the Button components to accept `href` prop and render as `<a>` when provided.

3. **Missing aria-label on nav** (Line 20)
   - Problem: No label on navigation landmark
   - Fix: Add `aria-label="Primary navigation"` or `aria-label="Main"`
   - Impact: Screen readers can't distinguish multiple navs

**Suggested changes:**
```tsx
<nav 
  className={`${customClass ? customClass : '...'}`}
  aria-label="Primary"
>
```

---

### packages/ui/src/Buttons/IconButton.tsx

**Issues:**

1. **Not a real button** (Lines 17-36)
   - Problem: Uses div with onClick instead of `<button>`
   - Fix: Render as button element
   - Impact: Not keyboard accessible, wrong semantics

**Suggested changes:**
```tsx
export const IconButton: React.FC<IconButtonProps> = ({ text, onClick, transparent = false, className, customWidth, icon, hoverIcon, mobile = false, disabled = false, id }) => (
  <button
    type="button"
    className={`rounded-3xl outline outline-[var(--px-1)] ... ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    id={id}
  >
    <div className={`inline-flex justify-center items-center gap-[var(--px-8)] ...`}>
      <div className="block group-hover:hidden">{icon}</div>
      {hoverIcon && <div className="hidden group-hover:block">{hoverIcon}</div>}
      <div className={`tracking-normal whitespace-nowrap font-light font-fira ...`}>
        {text}
      </div>
    </div>
  </button>
);
```

---

### packages/ui/src/Buttons/ButtonSleek.tsx

**Issues:**

1. **Same as IconButton** (Lines 14-30)
   - Problem: div instead of button
   - Fix: Render as `<button>` element
   - Impact: Not keyboard accessible

**Suggested changes:**
```tsx
export const ButtonSleek: React.FC<ButtonSleekProps> = ({ text, onClick, transparent = false, className, customWidth, disabled = false, id }) => (
  <button
    type="button"
    className={`h-[var(--px-36)] px-[var(--px-20)] py-[var(--px-8)] rounded-3xl ... ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    id={id}
  >
    <div className={`tracking-normal whitespace-nowrap m-auto text-[length:var(--px-12)] xl:text-[length:var(--px-10-37)] font-light font-fira ...`}>
      {text}
    </div>
  </button>
);
```

---

## Summary of Critical Issues

### High Priority (Breaks Accessibility)

1. **All modals missing dialog semantics** - Add `role="dialog"`, `aria-modal="true"`
2. **Buttons rendered as divs** - All ButtonSleek, IconButton, and similar should be `<button>` elements
3. **Navigation links using onClick** - Replace with `<a href>` for all page navigation
4. **Missing page landmarks** - Add `<main>`, ensure `<nav>` is present
5. **Missing heading hierarchy** - Add `<h1>` on every page view, proper `<h2>`, `<h3>` structure
6. **Form inputs missing labels** - All inputs, selects, textareas need associated `<label>`
7. **Clickable images/divs** - Wrap in `<button>` elements

### Medium Priority (Improves UX)

1. **Table structures using divs** - Add ARIA table roles or use real `<table>`
2. **Tab interfaces missing ARIA** - Add proper tablist/tab/tabpanel ARIA
3. **Images with conflicting accessibility** - Fix aria-label vs alt conflicts
4. **Decorative SVGs not hidden** - Add `aria-hidden="true"` to decorative graphics
5. **Missing section headings** - Add headings to identify page sections

### Low Priority (Polish)

1. **Time elements should use `<time>`** - Semantic clarity
2. **Key-value pairs could use `<dl>`** - Better semantics for definition lists
3. **Missing `aria-label` on some landmarks** - Helps distinguish multiple nav/footer elements

---

## Implementation Notes

**Critical:** All changes listed preserve visual appearance. They only improve:
- Semantic HTML structure
- Keyboard accessibility
- Screen reader experience
- ARIA attributes

**Testing Required:**
- Keyboard navigation (Tab, Enter, Space, Escape)
- Screen reader testing (NVDA, JAWS, VoiceOver)
- Focus visible states maintained
- No visual regressions

**Priority Order:**
1. Fix button/link semantics (biggest impact)
2. Add proper landmarks and headings
3. Fix form labels
4. Add modal dialog roles
5. Polish remaining ARIA attributes

---

## Mobile-Specific Components

### components/upload/SearchComponentMobile.tsx

**Issues:**

1. **SVG missing accessibility** (Lines 34-50)
   - Problem: Decorative SVG clipPath not marked as decorative
   - Fix: Add `aria-hidden="true"`
   - Impact: Screen readers read SVG code

2. **Tab pattern using divs** (Lines 56-69)
   - Same issue as desktop SearchComponent
   - Fix: Use `<button>` with ARIA tablist pattern
   - Impact: Not keyboard accessible

**Suggested changes:**
```tsx
<div className="flex" role="tablist">
  <button
    role="tab"
    aria-selected="true"
    type="button"
    className="flex-1/2 h-[var(--px-60)] p-3 flex items-center justify-center gap-2"
  >
    <span className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">SEARCH</span>
    <img src={searchIcon} alt="" aria-hidden="true" draggable={false} className="w-[var(--px-16)] h-[var(--px-16)]" />
  </button>
  <button
    role="tab"
    aria-selected="false"
    type="button"
    className="flex-1/2 h-[var(--px-60)] p-3 flex items-center justify-center gap-2 hover:cursor-pointer hover:underline search-component-upload-button"
    onClick={onUploadClick}
    id="search-component-upload-button"
  >
    <span className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">UPLOAD</span>
    <img src={uploadIcon} alt="" aria-hidden="true" draggable={false} className="w-[var(--px-16)] h-[var(--px-16)]" />
  </button>
</div>
```

3. **Images with conflicting accessibility** (Lines 59, 67, 81)
   - Problem: Using both `aria-label` and `alt` on images
   - Fix: Remove `aria-label`, keep `alt` empty for decorative images
   - Impact: Duplicate announcements

4. **Label not properly associated** (Lines 76-84)
   - Problem: "Mode" text not a label element
   - Fix: Use `<label htmlFor="search-mode-dropdown">`
   - Impact: Can't click text to focus select

5. **Missing heading** (Lines 114-120)
   - Problem: "Do you have a song in mind?" should be heading
   - Fix: Use `<h2>` or `<h3>`
   - Impact: No content hierarchy

---

### components/upload/UploadComponentMobile.tsx

**Issues:**

1. **SVG missing accessibility** (Lines 23-39)
   - Problem: Decorative SVG not marked
   - Fix: Add `aria-hidden="true"`
   - Impact: Screen reader reads SVG code

2. **Tab buttons using divs** (Lines 54-66)
   - Same as SearchComponentMobile
   - Fix: Use `<button>` elements with ARIA
   - Impact: Not keyboard accessible

3. **Images with aria-label** (Lines 60, 64)
   - Problem: Decorative images with aria-label
   - Fix: Remove aria-label, use `alt=""`
   - Impact: Unnecessary announcements

4. **Missing heading** (Lines 70-72)
   - Problem: "Discover the Power of Deep Sonic Analysis" should be heading
   - Fix: Wrap in `<h2>`
   - Impact: No content structure

**Suggested changes:**
```tsx
<h2 className="mt-[var(--px-10)] text-[length:var(--px-18)] font-helvetica font-light text-center leading-[var(--px-24)] uppercase">
  Discover the Power of<br />Deep Sonic Analysis
</h2>
```

---

### components/upload/PopularComponentMobile.tsx

**Issues:**

1. **SVG missing accessibility** (Lines 18-27)
   - Problem: Decorative SVG not hidden
   - Fix: Add `aria-hidden="true"`
   - Impact: Screen readers read SVG

2. **Missing heading** (Line 34)
   - Problem: "Beats Ready For You" should be heading
   - Fix: Use `<h2>`
   - Impact: No section identification

**Suggested changes:**
```tsx
<h2 className="text-[var(--color-primary)] text-[length:var(--px-18)] font-helvetica uppercase font-light">
  Beats Ready For You
</h2>
```

3. **Clickable divs instead of buttons** (Lines 38-69)
   - Problem: Track items use div with onClick
   - Fix: Use `<button type="button">`
   - Impact: Not keyboard accessible

**Suggested changes:**
```tsx
<button
  type="button"
  key={track.id}
  id={`popular-track-${track.id}`}
  className="group w-full h-[var(--px-70)] bg-[var(--color-primary-background)] border border-dotted border-slate-200 my-auto flex justify-between items-center hover:cursor-pointer hover:bg-[var(--color-primary-hover)] transition-colors"
  onClick={() => onTrackSelect?.(track)}
  aria-label={`Play ${track.title} by ${track.artist}, ${track.duration}`}
>
  {/* content */}
</button>
```

4. **Decorative images with different alt text** (Lines 46-55)
   - Problem: Icon states have descriptive alt text but are decorative
   - Fix: Use `alt=""` and `aria-hidden="true"` on both states
   - Impact: Screen readers read unnecessary descriptions

---

### components/Modals/PlaylistExport.tsx

**Issues:**

1. **Modal missing dialog semantics** (Lines 122-167)
   - Same as other modals
   - Fix: Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
   - Impact: Not announced as dialog

**Suggested changes:**
```tsx
<div 
  className="fixed inset-0 z-50 flex items-center justify-center" 
  role="dialog" 
  aria-modal="true" 
  aria-labelledby="export-dialog-title"
>
  <div
    className="absolute inset-0 bg-black/20 backdrop-blur-sm modal-backdrop"
    onClick={onClose}
    id="playlist-export-backdrop"
    aria-hidden="true"
  />

  <div className="relative z-10 bg-[var(--color-secondary)] ...">
    <div className="text-center w-full">
      <h2 id="export-dialog-title" className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
        PLAYLIST READY!
      </h2>
      {/* rest */}
    </div>
  </div>
</div>
```

2. **Decorative images** (Lines 133, 145)
   - Problem: Images have alt text but are decorative
   - Fix: Already have `aria-hidden="true"`, remove `alt` or use `alt=""`
   - Impact: Conflicting accessibility hints

---

## Additional UI Components Analysis

### Note on Button Components

All button wrapper components (`ButtonHeavyRight`, `ButtonHeavyLeft`, `LinkButton`, etc.) from `@resomix/ui` likely have the same issue as `ButtonSleek` and `IconButton` - they probably render as `div` with `onClick` instead of proper `<button>` or `<a>` elements.

**Recommendation:** Audit and fix all button components in `packages/ui/src/Buttons/` to:
1. Render as `<button type="button">` for actions
2. Render as `<a href="...">` when navigating (add `href` prop)
3. Apply proper disabled states
4. Ensure keyboard accessibility

---

## Final Recommendations

### Critical Path for Implementation

**Phase 1: Core Semantics (Week 1)**
1. Update all button components in `packages/ui/src/Buttons/` to use real `<button>` or `<a>` elements
2. Add `<main>` landmark to all page components
3. Add `<h1>` to every page view (Upload, Playlist mobile/desktop)
4. Add `role="dialog"` and `aria-modal="true"` to all modals

**Phase 2: Form Accessibility (Week 2)**
1. Associate all `<label>` elements with their inputs
2. Add `aria-label` to all range inputs (volume sliders)
3. Fix textarea labels in modals
4. Add `<fieldset>` and `<legend>` to rating controls

**Phase 3: Navigation & Links (Week 2-3)**
1. Convert all onClick navigation to `<a href>` tags
2. Add `aria-label` to navigation landmarks
3. Fix tab interfaces with proper ARIA tablist pattern
4. Ensure all external links have `rel="noopener noreferrer"`

**Phase 4: Content Structure (Week 3)**
1. Add proper heading hierarchy throughout
2. Mark all decorative SVGs/images with `aria-hidden="true"`
3. Remove conflicting aria-label + alt combinations
4. Add ARIA roles to table-like divs OR convert to real `<table>`

**Phase 5: Polish (Week 4)**
1. Use `<time>` elements for time displays
2. Convert key-value lists to `<dl>` elements
3. Add loading states with `aria-live` regions
4. Test with screen readers and keyboard navigation
5. Run automated accessibility tests (axe, Lighthouse)

### Testing Checklist

After implementing changes:

- [ ] All pages navigable with keyboard only (Tab, Enter, Space, Escape)
- [ ] All modals closeable with Escape key
- [ ] Screen reader announces page title on navigation
- [ ] Screen reader can navigate to main content
- [ ] All form inputs properly labeled
- [ ] All buttons and links keyboard accessible
- [ ] Focus indicators visible on all interactive elements
- [ ] No visual regressions (pixel-perfect comparison)
- [ ] Lighthouse accessibility score > 95
- [ ] axe DevTools shows 0 violations

### Browser/AT Testing Matrix

Test with:
- **Desktop:** Chrome + NVDA, Firefox + NVDA, Safari + VoiceOver
- **Mobile:** iOS Safari + VoiceOver, Android Chrome + TalkBack
- **Keyboard:** All interactive elements reachable and operable

---

## Appendix: Quick Reference

### Common Patterns to Fix

**❌ Wrong:**
```tsx
<div onClick={handleClick}>Click me</div>
```

**✅ Correct:**
```tsx
<button type="button" onClick={handleClick}>Click me</button>
```

---

**❌ Wrong:**
```tsx
<div onClick={() => window.location.href = url}>Go</div>
```

**✅ Correct:**
```tsx
<a href={url}>Go</a>
```

---

**❌ Wrong:**
```tsx
<img src={icon} aria-label="Icon" alt="Icon" />
```

**✅ Correct (decorative):**
```tsx
<img src={icon} alt="" aria-hidden="true" />
```

**✅ Correct (meaningful):**
```tsx
<img src={icon} alt="Icon description" />
```

---

**❌ Wrong:**
```tsx
<div>Label text</div>
<input id="field" />
```

**✅ Correct:**
```tsx
<label htmlFor="field">Label text</label>
<input id="field" />
```

---

**❌ Wrong:**
```tsx
<div className="modal">...</div>
```

**✅ Correct:**
```tsx
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Title</h2>
  ...
</div>
```

---

## Document Version

- **Version:** 1.0
- **Date:** October 15, 2025
- **Scope:** `/` and `/playlist` routes only
- **Status:** Complete
- **Next Steps:** Implementation phase 1
