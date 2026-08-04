# Resomix — Production-Ready SEO Metadata · Complete Page Backlog

Backlog source: the live route table in `apps/landing/src/App.tsx` (18 indexable
marketing routes + 6 noindex utility routes). Character counts are script-validated:
titles 50–60, descriptions 150–160. H1 policy: design-closed/approved H1s retained;
proposed H1s are flagged in Notes and require Marco's copy approval before shipping.
Companion strategy doc: docs/page-demos/SEO_GEO_RECOMMENDATIONS.md.

---

Page: Home — /
Type: Landing page
Intent: Commercial
SEO Meta Title: Resomix — Find & Analyse Electronic Music by Sound [50 chars]
SEO Meta Description: Drop one track and hear what belongs next. The PYXIS-1 engine powers sonic similarity search, track analysis and catalogue intelligence for electronic music. [157 chars]
H1 Tag: DROP ONE TRACK. FIND WHAT BELONGS NEXT.
Notes: Approved live H1 retained (brand-led; title carries keywords). Cannibalization guard vs /product/sonic-discovery: Home targets brand + broad 'music by sound'; SD owns 'find similar tracks'.

Page: Product Overview — /product
Type: Product overview (hub) page
Intent: Commercial
SEO Meta Title: Music Similarity & Audio Analysis Platform | Resomix [52 chars]
SEO Meta Description: Resomix uses PYXIS-1 to find sonically related tracks, analyse one recording in detail and make authorised catalogues searchable — one engine, three workflows. [159 chars]
H1 Tag: START WITH SOUND. KNOW WHERE TO GO NEXT.
Notes: Design-closed H1 retained. Hub page: intentionally broader than the three product pages to avoid overlap; deep intent routed via internal links.

Page: Sonic Discovery — /product/sonic-discovery
Type: Product (feature) page
Intent: Commercial
SEO Meta Title: Find Similar Tracks by Sound — Sonic Discovery | Resomix [56 chars]
SEO Meta Description: Start with one track or upload a reference. PYXIS-1 compares sonic profiles against a pre-analysed index and returns a ranked playlist of close matches. [152 chars]
H1 Tag: SONIC DISCOVERY — approved live hero line
Notes: Verify the live approved H1 before implementation (design-closed sections shipped this cycle); do not change without Marco. Cannibalization guard vs /solutions/djs: this page owns the feature term; DJs page owns audience phrasing.

Page: Track Intelligence — /product/track-intelligence
Type: Product (feature) page
Intent: Commercial
SEO Meta Title: Track Analysis: Structure, Key, BPM & Energy | Resomix [54 chars]
SEO Meta Description: Track Intelligence turns PYXIS-1 audio analysis into a readable view of one recording: structure, tempo, key, energy, timbre, spectral character, confidence. [157 chars]
H1 Tag: SEE HOW THE TRACK MOVES, CHANGES AND HOLDS TOGETHER.
Notes: H1 borrowed from the approved /product S5 heading family — verify the live TI page H1 and prefer its approved line if it differs. Guard vs /solutions/producers (audience page).

Page: Catalogue Intelligence — /product/catalog-intelligence
Type: Product (B2B feature) page
Intent: Commercial
SEO Meta Title: Make Your Music Catalog Searchable by Sound | Resomix [53 chars]
SEO Meta Description: Resomix processes authorised catalogue recordings into a private, partner-scoped sonic index. One reference query returns ranked matches from your catalogue. [157 chars]
H1 Tag: MAKE YOUR CATALOGUE DISCOVERABLE BY SOUND.
Notes: Design-closed H1 retained. Deliberate catalog (title/URL) vs catalogue (H1/body) spelling split covers both variants. Edge-301 required from /product/catalogue-intelligence. Guard vs record-labels + music-libraries solutions: this page owns the capability; those own audiences.

Page: Developers — /developers
Type: Developer overview page
Intent: Commercial
SEO Meta Title: Music Similarity & Audio Analysis API | Resomix Developers [58 chars]
SEO Meta Description: Integrate partner-scoped similarity and track-analysis services behind your own product. REST access through a guided pilot — no public sandbox to misuse. [154 chars]
H1 Tag: PUT SIMILARITY AND TRACK INTELLIGENCE INSIDE YOUR PRODUCT.
Notes: H1 aligned with the approved /product S7 heading; verify live page copy. Intent is commercial (evaluation), not documentation. Guard vs /partners/pilot: this page sells the integration; pilot page converts it.

Page: Partners — /partners
Type: Partner landing page
Intent: Commercial
SEO Meta Title: Partner With Resomix — Catalogue Discovery by Sound [51 chars]
SEO Meta Description: Labels, distributors, publishers and platforms make authorised catalogues searchable by sound. Keep your brand, storefront, licensing and customer control. [155 chars]
H1 Tag: MAKE YOUR CATALOGUE PART OF SOUND-FIRST DISCOVERY.
Notes: Proposed H1 (existing live H1 not in this program's scope — requires copy approval). Guard vs /product/catalog-intelligence: partners page = relationship pitch; CI page = capability.

Page: Guided Pilot — /partners/pilot  
Type: Conversion (lead-gen) page  
Intent: Transactional  
SEO Meta Title: Request a Guided Catalogue Pilot — Resomix for Partners [55 chars]  
SEO Meta Description: Test PYXIS-1 on your own catalogue. Define the scope, references and evaluation criteria, then review ranked results before deciding whether to integrate. [154 chars]  
H1 Tag: TEST PYXIS-1 ON THE MUSIC THAT MATTERS TO YOUR TEAM.  
Notes: H1 aligned with the approved pilot heading family (CI S8 / PO). Transactional page: title leads with the action.  


Page: Trust & Control — /trust
Type: Trust/policy explainer page
Intent: Informational
SEO Meta Title: Trust and Control at Resomix — How We Handle Audio [50 chars]
SEO Meta Description: User uploads are deleted within 24 hours. Partner catalogues stay inside private, partner-scoped indexes. No training on your content. No generated audio. [154 chars]
H1 Tag: THE AUDIO CAN BE ANALYSED WITHOUT BLURRING WHO IT BELONGS TO.
Notes: H1 = approved /product S9 heading family; verify live trust page's approved line. The boundary facts are the strongest meta copy on the site — keep them verbatim.

Page: Solutions: DJs — /solutions/djs
Type: Solution (audience) page
Intent: Commercial
SEO Meta Title: Find Your Next Track by Sound — Resomix for DJs & Sets [54 chars]
SEO Meta Description: Start from one known record and audition ranked, sonically related candidates. Build sets by energy, groove and character — beyond genre tags and charts. [153 chars]
H1 Tag: FIND THE NEXT TRACK WITHOUT HOURS OF UNFOCUSED DIGGING.
Notes: H1 from the approved /product pathways decision line. Guard vs /product/sonic-discovery noted there.

Page: Solutions: Music Curators — /solutions/music-curators
Type: Solution (audience) page
Intent: Commercial
SEO Meta Title: Playlist Curation by Sound — Resomix for Music Curators [55 chars]
SEO Meta Description: Move beyond charts and static tags. Start from an audio reference and review ranked, sonically related candidates for playlists and editorial programming. [154 chars]
H1 Tag: CURATE FROM THE SOUND, NOT ONLY THE CHART.
Notes: Proposed H1 pending copy approval (existing live line unknown in this scope). Guard vs DJs page: curators phrasing = playlists/editorial; DJs = sets.

Page: Solutions: Producers — /solutions/producers
Type: Solution (audience) page
Intent: Commercial
SEO Meta Title: Reference & Track Analysis by Sound — Resomix for Producers [59 chars]
SEO Meta Description: Inspect arrangement, energy and timbre in your own recording, then explore sonically related references — evidence for decisions that stay creatively yours. [156 chars]
H1 Tag: UNDERSTAND YOUR RECORDING AND STUDY THE MUSIC AROUND IT.
Notes: H1 from the approved /product pathways decision line. Guard vs /product/track-intelligence: feature page owns 'track analysis' head term; this page owns the producer angle.

Page: Solutions: Record Labels — /solutions/record-labels
Type: Solution (audience) page
Intent: Commercial
SEO Meta Title: Catalogue Search by Sound for Record Labels | Resomix [53 chars]
SEO Meta Description: Make authorised label and distributor catalogues searchable by sound. Surface older, relevant recordings beside new releases through ranked sonic matches. [154 chars]
H1 Tag: GIVE AUTHORISED RECORDINGS ANOTHER ROUTE INTO DISCOVERY.
Notes: H1 from the approved pathways decision line. Guard vs /product/catalog-intelligence noted there; this page carries the audience term 'record labels'.

Page: Solutions: Music Publishers — /solutions/music-publishers
Type: Solution (audience) page
Intent: Commercial
SEO Meta Title: Sonic Catalogue Search for Music Publishers | Resomix [53 chars]
SEO Meta Description: Turn your catalogue into a living asset. Resomix analyses authorised recordings so publishers can rediscover works and explore representation by sound. [151 chars]
H1 Tag: TURN YOUR CATALOGUE INTO A LIVING ASSET
Notes: Marco's approved, design-closed H1 retained; description reuses his heading verbatim for alignment.

Page: Solutions: Sync Agencies — /solutions/sync-agencies
Type: Solution (audience) page
Intent: Commercial
SEO Meta Title: Reference-Based Music Search for Sync Agencies | Resomix [56 chars]
SEO Meta Description: Use an audio reference to surface sonically relevant candidates for human review. Resomix supports the search — never automated clearance or rights calls. [154 chars]
H1 Tag: SURFACE CANDIDATES BY SOUND. KEEP EVERY CLEARANCE DECISION HUMAN.
Notes: Proposed H1 pending copy approval. Claim boundary honoured: no sync placement automation.

Page: Solutions: Music Libraries — /solutions/music-libraries-sample-providers
Type: Solution (audience) page
Intent: Commercial
SEO Meta Title: Sound-First Search for Music & Sample Libraries | Resomix [57 chars]
SEO Meta Description: Help authorised libraries and sample catalogues be explored through structure, texture and sonic relationships — ranked results from one audio reference. [153 chars]
H1 Tag: LET THE LIBRARY BE EXPLORED THROUGH ITS SOUND.
Notes: Proposed H1 pending copy approval. FLAG: long slug is fine but keep it stable; title targets both 'music libraries' and 'sample libraries'.

Page: About — /about
Type: About page
Intent: Navigational
SEO Meta Title: About Resomix — The Team Behind PYXIS-1 Audio Analysis [54 chars]
SEO Meta Description: Built in Thessaloniki by DJs and signal-processing engineers, Resomix powers Sonic Discovery, Track Intelligence and Catalogue Intelligence from the audio. [155 chars]
H1 Tag: A SONIC INTELLIGENCE PLATFORM FOR THOSE WHO FEEL THE MUSIC.
Notes: Design-closed H1 retained (v1.1 Listening Observatory).

Page: Subscribe — /subscribe
Type: Account/upgrade page
Intent: Transactional
SEO Meta Title: Subscribe to Resomix — Unlock Deeper Sonic Discovery [52 chars]
SEO Meta Description: Upgrade your Resomix plan for expanded discovery and analysis, and manage billing securely. Start in the free production beta and grow when you are ready. [154 chars]
H1 Tag: UNLOCK THE DEPTH YOUR DISCOVERY DESERVES.
Notes: FLAG: verify whether this page is auth-gated in production — if so, set noindex and keep meta for UX only. Plan claims need billing verification, as on /pricing.

Page: Contact — /contact  
Type: Contact page  
Intent: Navigational  
SEO Meta Title: Contact Resomix — Support, Partnerships and Press Enquiries [59 chars]  
SEO Meta Description: Reach the Resomix team in Thessaloniki for product support, partner and catalogue enquiries, or press. We reply from [support@resomix.com](mailto:support@resomix.com) within the beta. [153 chars]  
H1 Tag: TALK TO THE PEOPLE BEHIND THE SOUND.  
Notes: Proposed H1 pending copy approval. FLAG: 'reply within the beta' phrasing is a placeholder — replace with an approved support-response statement or trim.

Page: Auth — /auth/*
Type: Utility (auth) pages
Intent: Navigational
SEO Meta Title: Sign In or Create Account | Resomix [35 chars]
SEO Meta Description: Sign in to Resomix or create a free account to start sonic discovery in the live production beta. [97 chars]
H1 Tag: SIGN IN TO RESOMIX
Notes: noindex,nofollow. Meta for UX/tab title only; counts intentionally relaxed.

Page: Profile — /profile
Type: Utility (account) page
Intent: Navigational
SEO Meta Title: Your Profile | Resomix [22 chars]
SEO Meta Description: Manage your Resomix account, plan and settings. [47 chars]
H1 Tag: YOUR PROFILE
Notes: noindex. App surface.

Page: Sessions — /sessions
Type: Utility (account) page
Intent: Navigational
SEO Meta Title: Active Sessions | Resomix [25 chars]
SEO Meta Description: Review and manage your active Resomix sessions. [47 chars]
H1 Tag: ACTIVE SESSIONS
Notes: noindex. App surface.

Page: Change Password — /change-password
Type: Utility (account) page
Intent: Navigational
SEO Meta Title: Change Password | Resomix [25 chars]
SEO Meta Description: Update your Resomix account password securely. [46 chars]
H1 Tag: CHANGE PASSWORD
Notes: noindex.

Page: Error — /error
Type: Utility page
Intent: —
SEO Meta Title: Something Went Wrong | Resomix [30 chars]
SEO Meta Description: An error occurred. Head back to Resomix and continue discovering by sound. [74 chars]
H1 Tag: SOMETHING WENT WRONG
Notes: noindex.

Page: Not Found — * (404)
Type: Utility page
Intent: —
SEO Meta Title: Page Not Found | Resomix [24 chars]
SEO Meta Description: That page does not exist. Return to Resomix to keep exploring music by sound. [77 chars]
H1 Tag: PAGE NOT FOUND
Notes: noindex; serve real 404 status at the edge, not a soft 200.