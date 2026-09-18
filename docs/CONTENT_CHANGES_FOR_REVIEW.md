# What changed on each page, before and after

Prepared 18 September 2026, for George.

Every change made in response to Vladimir's ShelfSignal report, page by page. The left column is
what the page said before, the right column is what it says now. Everything here is live on the
staging site and goes to resomix.com with the next release.

The report's finding was that assistants were reading our pages and leaving without naming us,
because the pages talked about PYXIS-1 and rarely said Resomix. So most changes add the brand and
the words buyers actually use, in text that was already there.

## Site-wide

| Before | After |
|---|---|
| **Beta notice, shown above every page** Resomix is currently in beta. You may encounter bugs or incomplete features while we continue improving the sonic discovery experience. | **Beta notice** Resomix is a sound-first music discovery and track analysis platform, currently in beta. You may encounter bugs or incomplete features while we keep improving it. |
| **Page addresses** Each page answered on two addresses, and the one we told search engines about redirected to the other. Links to www.resomix.com dropped the page and landed on the home page. | **Page addresses** One address per page. Links with www now open the same page on resomix.com. |
| **Machine-readable labels** Only the company name, the website and a description. | **Machine-readable labels** The company name now carries our four social profiles, four contact addresses and the Thessaloniki location. Each solution and partner page declares the service it offers, the developer page declares the API, and every questions section and the Sonic Discovery steps are declared so assistants can read them. |
| **llms.txt, the short site guide for AI systems** A list of pages with one line each. | **llms.txt** Rewritten with the words buyers use and a short facts block: not an audio fingerprinting service, uploads deleted within 24 hours, no training on user or partner audio, partner catalogues kept separate. |

## Home

https://resomix.com/

| Before | After |
|---|---|
| **Search description** Drop one track and hear what belongs next. The PYXIS-1 engine powers sonic similarity search, track analysis and catalogue intelligence for electronic music. | **Search description** Resomix finds electronic music by how it sounds. Drop one track and its PYXIS-1 engine returns a ranked shortlist, reads one recording or searches a catalogue. |
| **Opening paragraph under the heading** Resomix reveals a track's unique identity, subtle connections, and its place within a music catalogue. | **Opening paragraph under the heading** Resomix is a music similarity search and audio analysis platform for electronic music. Drop one track and it reveals the track's identity, its closest sonic relatives and its place within a music catalogue. |
| **Step 2 heading in “How Resomix works”** PYXIS-1 builds a sonic profile | **Step 2 heading in “How Resomix works”** Resomix's PYXIS-1 engine builds a sonic profile |

## Product overview

https://resomix.com/product

| Before | After |
|---|---|
| **Opening paragraph under the heading** Resomix uses PYXIS-1 to find related tracks, read one recording in detail, or make an authorised catalogue searchable by sound. | **Opening paragraph under the heading** Resomix is a music similarity search and audio analysis platform. It uses its PYXIS-1 engine to find related tracks, read one recording in detail, or make an authorised catalogue searchable by sound. |
| **Section number above the closing block** 10 // Choose your route | **Section number above the closing block** 11 // Choose your route |
| **Questions section** There was none. | **Questions section, added at the bottom before the call to action** Heading: Questions about the Resomix platform<br><br>**What is the difference between Sonic Discovery, Track Intelligence and Catalogue Intelligence?**<br>Sonic Discovery finds tracks that sound like a reference. Track Intelligence explains one recording, from structure and tempo to key, energy, timbre and mood. Catalogue Intelligence applies the same engine to an authorised partner catalogue inside a private index. All three run on Resomix's PYXIS-1 engine.<br><br>**What is PYXIS-1?**<br>PYXIS-1 is Resomix's proprietary audio-analysis and similarity engine. It extracts more than 70 measurable characteristics across rhythm, harmony, timbre, structure, spectral profile and energy, and combines them into one sonic profile per recording. It is not a generative system and does not create audio.<br><br>**Does Resomix identify songs?**<br>No. Resomix is not an audio fingerprinting service. It does not tell you what a recording is. It finds and explains recordings by how they sound.<br><br>**Does Resomix train on my audio?**<br>No. Uploaded references are deleted no later than 24 hours after upload or analysis, and neither user nor partner audio is used to train or fine-tune PYXIS-1.<br><br>**Is there an API?**<br>Yes. Resomix offers a partner-scoped REST API for search, similarity and track analysis against your own catalogue, reached through a guided pilot. There is no public sandbox. |

## Sonic Discovery

https://resomix.com/product/sonic-discovery

| Before | After |
|---|---|
| **Search description** Start with one track or upload a reference. PYXIS-1 compares sonic profiles against a pre-analysed index and returns a ranked playlist of close matches. | **Search description** Resomix Sonic Discovery is a music similarity search tool. Start with one track or upload a reference and PYXIS-1 returns a ranked playlist of similar tracks. |
| **Opening paragraph under the heading** Search by how the music actually sounds. PYXIS-1 reads the groove, energy, timbre and structure of your reference (drawn from 70+ measurable audio characteristics) and returns a ranked shortlist you can listen, analyse, and develop. | **Opening paragraph under the heading** Resomix Sonic Discovery is a music similarity search tool that searches by how the music actually sounds. Resomix's PYXIS-1 engine reads the groove, energy, timbre and structure of your reference (drawn from 70+ measurable audio characteristics) and returns a ranked shortlist you can listen to, analyse and develop. |
| **Questions section** There was none. | **Questions section, added at the bottom before the call to action** Heading: Questions about Resomix Sonic Discovery<br><br>**How do I find tracks that sound like a track I already have?**<br>Search for the track in Resomix, or upload the file, and Sonic Discovery returns a ranked playlist of the closest matches by sound, judged on groove, energy, timbre and structure rather than on genre tags or release date.<br><br>**Can I search for music by uploading a file?**<br>Yes. Upload an MP3, WAV, FLAC or AIFF as your reference. Resomix processes it privately, uses it only as the query, and deletes the source audio no later than 24 hours after upload or analysis.<br><br>**Is Sonic Discovery an audio fingerprinting or song-identification tool?**<br>No. Fingerprinting tells you what a recording is. Resomix tells you what sounds like it, meaning the tracks with the strongest measured sonic relationship to your reference, whoever released them and whenever.<br><br>**How does Resomix decide which tracks are similar?**<br>Resomix's PYXIS-1 engine builds a sonic profile from more than 70 measurable audio characteristics of the whole recording, then compares it with a pre-analysed index. The result is deterministic, so the same reference against the same index returns the same shortlist, each result with its similarity score.<br><br>**Which catalogue does Sonic Discovery search?**<br>The Resomix catalogue of electronic music, already profiled by PYXIS-1. Partner catalogues are separate and private. See Catalogue Intelligence.<br><br>**Can DJs use it to find tracks that mix well together?**<br>Yes. The shortlist is ranked by groove, energy and structure, and Track Intelligence shows the key, Camelot code and BPM of any result, so you can check compatibility before you play it. The selection stays yours. |
| **The five steps of how it works** Drawn inside the diagram only, as picture text, which assistants and screen readers cannot read. | **The five steps, added as plain text under the diagram** Heading: How Resomix Sonic Discovery works, in five steps<br>1. **Choose a reference track** Search for a track in Resomix, or upload your own audio file.<br>2. **Resomix analyses the sound** The PYXIS-1 engine measures rhythm, harmony, timbre, structure and energy, using more than 70 audio characteristics.<br>3. **Resomix compares it with the catalogue** The sound profile is compared with every track Resomix has already analysed.<br>4. **Resomix ranks the closest matches** Tracks are ordered by similarity score, automatically.<br>5. **You get a playlist** Listen to the results, save them, export them, or use any result as your next reference. |

## Track Intelligence

https://resomix.com/product/track-intelligence

| Before | After |
|---|---|
| **Search description** Track Intelligence turns PYXIS-1 audio analysis into a readable view of one recording: structure, tempo, key, energy, timbre, spectral character, confidence. | **Search description** Resomix Track Intelligence is track analysis software. It reads BPM, key and Camelot, structure, energy, loudness, timbre, genre and mood from one recording. |
| **Opening paragraph under the heading** Through 70+ measurable audio characteristics, PYXIS-1 measures a song's rhythm, energy, harmony, timbre, spectral behaviour and structure, and turns these traits into one readable track profile. | **Opening paragraph under the heading** Resomix Track Intelligence is track analysis software for one recording at a time. Through 70+ measurable audio characteristics, Resomix's PYXIS-1 engine measures a song's tempo, key, rhythm, energy, harmony, timbre, spectral behaviour and structure, and turns these traits into one readable track profile. |
| **Intro line of “How the track unfolds”** A structural score with the waveform, beat grid and sections on one timeline. Select a section to read its role. | **Intro line of “How the track unfolds”** BPM detection and a structural score, with the waveform, beat grid and sections on one timeline. Select a section to read its role. |
| **Closing sentence of “How energy moves through the track”** DJs check the track's flow before building a set. Producers study how arrangements are made. Curators focus on the pacing. Catalogue teams turn libraries into searchable tags. Our analysis just describes the music; the decision-making process is in your hands only. | **Closing sentence of “How energy moves through the track”** DJs check the track's flow before building a set. Producers study how arrangements are made. Curators focus on the pacing. Catalogue teams turn libraries into searchable tags. Resomix's analysis describes the music. The decision stays in your hands. |
| **Intro line of “Key and harmonic behaviour”** Detected key, confidence and a readable chromagram strip up front, with full pitch evidence and harmonic relationships one step deeper. | **Intro line of “Key and harmonic behaviour”** Musical key detection with confidence. The detected key and Camelot code sit up front with a readable chromagram strip, and the full pitch evidence and harmonic relationships one step deeper. |
| **Intro line of “A profile, not a label”** Genre, style, mood and vibe as coordinated signals: stronger and weaker, never absolute. | **Intro line of “A profile, not a label”** Automatic genre, style, mood and instrumentation tagging, shown as coordinated signals with confidence. Stronger and weaker, never absolute. |
| **Questions section** There was none. | **Questions section, added at the bottom before the call to action** Heading: Questions about Resomix Track Intelligence<br><br>**How do I find the BPM and key of a track?**<br>Upload the track to Resomix and open Track Intelligence. Tempo, key and Camelot code are measured directly from the audio and shown with a confidence value, alongside structure, loudness and energy.<br><br>**How accurate is the key detection?**<br>Measured values such as tempo, key and loudness are read from the recording, so the same file always returns the same result, and the key is shown with its confidence and any alternative key. Predicted values such as genre and mood are classification signals, shown with confidence, never as absolutes.<br><br>**Does Resomix tag genre and mood automatically?**<br>Yes, as predicted signals. Track Intelligence reports genre and style, mood and theme, and instrumentation such as vocal presence, each with a confidence level and with secondary signals kept visible instead of forced into one label.<br><br>**Can Track Intelligence enrich catalogue metadata?**<br>For a partner catalogue, yes. The same analysis runs across every authorised recording so structure, tempo, key, mood and genre are described in the same terms for every track, and it can flag inconsistent tagging. Resomix does not edit your metadata. It gives your team consistent evidence to work from.<br><br>**Can I analyse my own unreleased track?**<br>Yes. The upload is processed privately, is not used to train PYXIS-1, and the source audio is deleted no later than 24 hours after upload or analysis.<br><br>**Can I get the analysis as data?**<br>Partners can retrieve versioned, structured JSON through the Resomix API, with rhythm, tonality, loudness, mood, structure and provenance fields. Analysis access is enabled on request. |

## Catalogue Intelligence

https://resomix.com/product/catalog-intelligence

| Before | After |
|---|---|
| **Search description** Resomix processes authorised catalogue recordings into a private, partner-scoped sonic index. One reference query returns ranked matches from your catalogue. | **Search description** Search your music catalogue by sound. Resomix processes authorised recordings into a private, partner-scoped index, and one reference returns ranked matches. |
| **Opening paragraph under the heading** with PYXIS-1, Resomix creates a sonic profile for every track in your sound library and makes your music searchable by sound. Start with one recording and discover ranked matches from across your catalogue. | **Opening paragraph under the heading** Resomix Catalogue Intelligence lets labels, publishers, distributors and libraries search a music catalogue by sound. Resomix's PYXIS-1 engine creates a sonic profile for every authorised recording and makes the catalogue searchable by sound. Start with one recording and discover ranked matches from across your catalogue. |
| **Paragraph in “Add sonic retrieval without replacing the systems you already run”** Resomix sits alongside your existing tools as a discovery and analysis layer. In a guided pilot, you test catalogue similarity and Track Intelligence on an agreed sample. In a scoped integration, authorised server-side requests bring the results into your own product or workflow. | **Paragraph in “Add sonic retrieval without replacing the systems you already run”** Resomix sits alongside your existing tools as a discovery and analysis layer. In a guided pilot, you test catalogue similarity and Track Intelligence on an agreed sample. In a scoped integration, authorised server-side requests bring the results into your own product or workflow. Catalogues are delivered in batches through managed ingestion, and the private index is rebuilt as each batch lands. |
| **Questions section** There was none. | **Questions section, added at the bottom before the call to action** Heading: Questions about Resomix Catalogue Intelligence<br><br>**How can a label make its back catalogue discoverable?**<br>Resomix processes the authorised recordings once into a private, partner-scoped sonic index. From then on any track, old or new, can be returned when it sounds right for the reference, without waiting for streams, sales or editorial attention.<br><br>**How do I find similar tracks inside our own catalogue?**<br>Use any indexed track as the reference, or upload a recording. PYXIS-1 compares it with your catalogue and returns the closest matches, ranked by similarity, with no manual shortlisting.<br><br>**Is our catalogue shared with other partners or made public?**<br>No. Each partner's audio, derived profiles and index stay inside that partner's scope. There is no shared partner pool, and partner content is not made publicly available.<br><br>**Is our audio used to train PYXIS-1?**<br>No. Partner content is not used to train or fine-tune PYXIS-1, and Resomix does not generate derivative audio.<br><br>**What do we need to deliver?**<br>Authorised audio as MP3, WAV, FLAC or AIFF, and a CSV manifest with ISRC, title, artist and filename for each track, through the managed partner workflow.<br><br>**How large a catalogue can Resomix process?**<br>Catalogues are ingested in batches and the index is rebuilt as each batch lands, so the size is agreed per pilot rather than capped up front. A representative sample is enough to start. |

## Developers

https://resomix.com/developers

| Before | After |
|---|---|
| **Search description** Integrate partner-scoped similarity and track-analysis services behind your own product. REST access through a guided pilot, with no public sandbox to misuse. | **Search description** The Resomix API is a music similarity and audio analysis API with search, similarity by track or upload, and versioned track analysis of your own catalogue. |
| **Opening paragraph under the heading** Search your own catalogue by sound and rank it by how the music actually sounds, through a partner-scoped REST API. Structured Track Intelligence analysis is enabled on request, against your own catalogue. | **Opening paragraph under the heading** The Resomix API is a music similarity and audio analysis API for partners, powered by Resomix's PYXIS-1 engine. Search your own catalogue by sound and rank it by how the music actually sounds, through a partner-scoped REST API. Structured Track Intelligence analysis (tempo, key, loudness, structure, mood and genre signals) is enabled on request, against your own catalogue. |

## Partners

https://resomix.com/partners

| Before | After |
|---|---|
| **Search description** Labels, distributors, publishers and platforms make authorised catalogues searchable by sound. Keep your brand, storefront, licensing and customer control. | **Search description** Partner with Resomix. Labels, distributors, publishers and platforms make authorised catalogues searchable by sound through a private pilot or the live API. |
| **Opening paragraph under the heading** Start with a private catalogue pilot, or integrate the live API. Bring sound-first discovery to your catalogue, platform or music product. | **Opening paragraph under the heading** Resomix works with labels, distributors, publishers, music libraries and music-technology products in three ways. Start with a private catalogue pilot, integrate the live partner API, or scope a deployment together. Bring sound-first discovery to your catalogue, platform or music product. |

## Private Catalogue Pilot

https://resomix.com/partners/pilot

| Before | After |
|---|---|
| **Search description** Test PYXIS-1 on your own catalogue. Define the scope, references and evaluation criteria, then review ranked results before deciding whether to integrate. | **Search description** Test Resomix on your own catalogue. A managed private pilot for labels, distributors and catalogue teams. Agree scope and scorecard, then review ranked results. |
| **Opening paragraph under the heading** A managed private pilot for labels, distributors and catalogue teams. Test sonic discovery on authorised material, with success criteria agreed up front. | **Opening paragraph under the heading** The Resomix Private Catalogue Pilot is a managed evaluation for labels, distributors and catalogue teams. Test Resomix's PYXIS-1 engine on authorised material, with success criteria agreed up front. |

## Record Labels

https://resomix.com/solutions/record-labels

| Before | After |
|---|---|
| **Search description** Make authorised label and distributor catalogues searchable by sound. Surface older, relevant recordings beside new releases through ranked sonic matches. | **Search description** Resomix lets record labels search their catalogue by sound. Authorised recordings become a private index where older, relevant tracks surface beside new ones. |
| **Opening paragraph under the heading** Running a label is hard, and it always has been. Choosing the artists to release, curating every project with care, managing a growing catalogue, and consistently releasing music that's in line with the essence of your project all require time and dedication. | **Opening paragraph under the heading** Resomix is a catalogue search tool for record labels. It analyses the audio itself with its PYXIS-1 engine, so a label can search and compare its own releases by how they sound, not only by metadata. Running a label is hard, and it always has been. Choosing the artists to release, curating every project with care, managing a growing catalogue, and consistently releasing music that's in line with the essence of your project all require time and dedication. |
| **Questions section** There was none. | **Questions section, added at the bottom before the call to action** Heading: Questions labels ask about Resomix<br><br>**How can a label make its back catalogue discoverable?**<br>Resomix profiles the authorised catalogue once into a private index. An older release can then surface beside a new signing whenever the two are close in sound, with no need for it to have a history of attention.<br><br>**Can we compare a new demo with our existing catalogue?**<br>Yes. Use the demo as the reference and Resomix returns the releases in your catalogue that sit closest to it, ranked by sonic similarity.<br><br>**Can Resomix help us answer sync requests?**<br>It surfaces candidates from your catalogue that match the reference by sound, for your team to review. Clearance and rights decisions stay human.<br><br>**Is our catalogue visible to other labels?**<br>No. Partner catalogues are logically isolated, restricted to authorised access, and never pooled. |

## Music Publishers

https://resomix.com/solutions/music-publishers

| Before | After |
|---|---|
| **Opening paragraph under the heading** Music publishers face a daunting task: creating a cohesive catalog that’s both genuine and marketable, while also knowing how to make the most of every track as the collection expands. | **Opening paragraph under the heading** Resomix helps music publishers search and understand their repertoire by sound. Music publishers face a daunting task: creating a cohesive catalogue that’s both genuine and marketable, while also knowing how to make the most of every track as the collection expands. |
| **First editorial paragraph, British spelling** That’s no trivial task, especially if you consider that your average catalog hosts tens of thousands of songs! | **First editorial paragraph, British spelling** That’s no trivial task, especially if you consider that your average catalogue hosts tens of thousands of songs! |
| **Second editorial paragraph, British spelling** The good thing is that technology comes to the rescue with automating systems that help search, analyze, and optimize large catalogs in ways no human can; only these powerful engines can dive into a music collection so deeply and thoroughly, delivering results in line with what you’re looking for. | **Second editorial paragraph, British spelling** The good thing is that technology comes to the rescue with automating systems that help search, analyse, and optimise large catalogues in ways no human can; only these powerful engines can dive into a music collection so deeply and thoroughly, delivering results in line with what you’re looking for. |
| **Section heading, British spelling** A Big Catalog Is Not Enough – When You Don’t Know It | **Section heading, British spelling** A Big Catalogue Is Not Enough – When You Don’t Know It |
| **First paragraph of that section, British spelling** Spending years building a catalog, only to barely touch its true potential, is the problem of every music publisher today. | **First paragraph of that section, British spelling** Spending years building a catalogue, only to barely touch its true potential, is the problem of every music publisher today. |
| **Second paragraph, British spelling** The story usually goes like this: new releases are prioritized, while older songs slowly disappear from view. That’s partly intrinsic to the modern music industry, where new songs are more sought-after, whereas songs that are not old enough to be considered vintage live in this limbo where no one looks for them. | **Second paragraph, British spelling** The story usually goes like this: new releases are prioritised, while older songs slowly disappear from view. That’s partly intrinsic to the modern music industry, where new songs are more sought-after, whereas songs that are not old enough to be considered vintage live in this limbo where no one looks for them. |
| **Third paragraph** Metadata can help rediscover songs buried in a catalog, but it’s not designed to see sonic connection: it shows you songs that are tagged the same way, but that doesn’t mean they’re sonically related, or that they can fill the same purpose. What you need is an engine specifically designed to explore your entire catalogue through the sound itself. | **Third paragraph** Metadata can help rediscover songs buried in a catalogue, but it’s not designed to see sonic connection: it shows you songs that are tagged the same way, but that doesn’t mean they’re sonically related, or that they can fill the same purpose. What you need is an engine specifically designed to explore your entire catalogue through the sound itself. |
| **First paragraph of “Activate Your Catalogue with Resomix”, British spelling** Resomix analyzes the structure of a song at a granular level, going deeper than any search engine and extrapolating the core of a song, its sonic soul. | **First paragraph of “Activate Your Catalogue with Resomix”, British spelling** Resomix analyses the structure of a song at a granular level, going deeper than any search engine and extrapolating the core of a song, its sonic soul. |
| **Second closing paragraph** By analyzing a catalogue through sound, Resomix can help publishers spend less time looking for music and more time understanding what they actually have at their disposal today. Resomix’s similarity engine is not designed to replace the knowledge and relationships that are at the heart of music publishing, but to help you amplify the value of the collection you’ve built. | **Second closing paragraph** By analysing a catalogue through sound, Resomix can help publishers spend less time looking for music and more time understanding what they actually have at their disposal today. Resomix’s similarity engine is not designed to replace the knowledge and relationships that are at the heart of music publishing, but to help you amplify the value of the collection you’ve built. |
| **Questions section** There was none. | **Questions section, added at the bottom before the call to action** Heading: Questions publishers ask about Resomix<br><br>**How can a publisher find related works across its catalogue?**<br>Start from any recording as the reference. Resomix's PYXIS-1 engine compares it with the represented works already profiled in your private index and returns the closest, whatever their era or how they were tagged.<br><br>**Does Resomix make rights or licensing decisions?**<br>No. Resomix surfaces sonic relationships and candidates. Rights context, artist relationships and professional judgement stay with your team.<br><br>**Is our catalogue exposed to anyone else?**<br>No. Authorised audio, derived profiles and the index stay inside your partner scope, and partner content is not made public.<br><br>**How do we start?**<br>With a guided pilot on a representative sample of your catalogue. You agree the scope, the reference tracks and how results are judged, then review ranked matches before deciding whether to go further. |

## Sync Agencies

https://resomix.com/solutions/sync-agencies

| Before | After |
|---|---|
| **Opening paragraph under the heading** A talented sync agent can see opportunities where others don't; someone who can connect the dots, understand creative visions, and give musicians the spotlight they deserve. | **Opening paragraph under the heading** Resomix is a search tool for sync agencies. It finds the tracks in a catalogue that match a reference or a brief by how they sound, and leaves every clearance decision human. A talented sync agent can see opportunities where others don't; someone who can connect the dots, understand creative visions, and give musicians the spotlight they deserve. |
| **Questions section** There was none. | **Questions section, added at the bottom before the call to action** Heading: Questions sync agencies ask about Resomix<br><br>**How do I find music that matches a creative brief?**<br>Start from the reference the brief gives you, or the closest track you know. Resomix returns ranked candidates from the catalogue that share its groove, energy, timbre and structure, for your team to review, refine and clear.<br><br>**Does Resomix clear or license music?**<br>No. It supports the search. Clearance, rights and placement decisions are made by rights holders.<br><br>**Can it search our agency's own catalogue?**<br>Yes, through a private catalogue pilot. Your authorised recordings are profiled into a partner-scoped index that only your team can search.<br><br>**Does it replace our tagging system?**<br>No. Tags stay yours and stay useful. Resomix adds a sonic layer beneath them, so a track that was never tagged for a mood can still be found by how it feels. |

## Music Libraries and Sample Providers

https://resomix.com/solutions/music-libraries-sample-providers

| Before | After |
|---|---|
| **Search description** Help authorised libraries and sample catalogues be explored through structure, texture and sonic relationships, with ranked results from one audio reference. | **Search description** Resomix gives music libraries and sample providers search by sound. Start from one sound and PYXIS-1 surfaces related loops, samples and tracks in the library. |
| **Opening paragraph under the heading** The bigger a music library becomes, the more difficult it becomes to navigate. | **Opening paragraph under the heading** Resomix is a sound-first search layer for music libraries and sample providers. Users start from a sound they like and find its relatives across the catalogue, instead of typing what they cannot describe. The bigger a music library becomes, the more difficult it becomes to navigate. |
| **Second paragraph of “A new way to explore your catalogue”** By analysing the sonic characteristics of individual sounds and loops, PYXIS-1 can identify subtle relationships that traditional metadata might miss. | **Second paragraph of “A new way to explore your catalogue”** By analysing the sonic characteristics of individual sounds and loops, Resomix's PYXIS-1 engine can identify subtle relationships that traditional metadata might miss. |
| **Questions section** There was none. | **Questions section, added at the bottom before the call to action** Heading: Questions libraries ask about Resomix<br><br>**Can users search a sample library by sound instead of tags?**<br>Yes. A user picks a sound they already like as the reference, and Resomix returns the sounds across the library that share its sonic character, wherever they sit in the pack structure.<br><br>**How does Resomix fit alongside our existing tags?**<br>It sits beneath them. Tags remain the way users describe what they want. Resomix answers the case where they can hear it but cannot type it.<br><br>**Is our library shared with anyone else?**<br>No. Each partner's audio, profiles and index stay inside that partner's own scope, and partner content is never made public or used to train PYXIS-1.<br><br>**How do we start?**<br>With a private catalogue pilot on a representative sample, or through the partner API for a scoped integration into your own product.<br>Link: [ Start a Catalogue Pilot → ] |

## DJs

https://resomix.com/solutions/djs

| Before | After |
|---|---|
| **Search description** Start from one known record and audition ranked, sonically related candidates. Build sets by energy, groove and character, beyond genre tags and charts. | **Search description** Resomix is a music discovery tool for DJs. Start from one record and audition a ranked shortlist that mixes well, matched on groove, energy and character. |
| **Opening paragraph under the heading** Learning to DJ might not sound that difficult. Becoming a great DJ, however, is an entirely different matter. | **Opening paragraph under the heading** Resomix is a music discovery tool for DJs. Pick one track and it returns a ranked shortlist of records that sound like it, so you find what to play next without hours of digging. Learning to DJ might not sound that difficult. Becoming a great DJ, however, is an entirely different matter. |
| **Questions section** There was none. | **Questions section, added at the bottom before the call to action** Heading: Questions DJs ask about Resomix<br><br>**How do DJs find tracks that mix well together with Resomix?**<br>Start from the track you know you will play. Resomix ranks candidates by groove, energy and structure, and Track Intelligence shows each one's key, Camelot code and BPM, so you can check compatibility before you commit. The selection is yours.<br><br>**Can I use my own tracks as the reference?**<br>Yes. Upload an MP3, WAV, FLAC or AIFF. It is processed privately and deleted no later than 24 hours after upload or analysis.<br><br>**Does it only return popular tracks?**<br>No. Results are ranked by measured sound, not by charts, release date or play counts, which is how forgotten B-sides come back into sets.<br><br>**Can I save a shortlist?**<br>Yes. Save the results as a playlist in Resomix, export it, or use any result as the next reference and keep digging.<br><br>**Is Resomix free for DJs?**<br>Free to start in the production beta. A Pro plan adds depth, and the plans are compared on the pricing page. |

## Music Curators

https://resomix.com/solutions/music-curators

| Before | After |
|---|---|
| **Search description** Move beyond charts and static tags. Start from an audio reference and review ranked, sonically related candidates for playlists and editorial programming. | **Search description** Resomix is a playlist curation tool for music curators. Start from an audio reference and review ranked, sonically related candidates beyond charts and tags. |
| **Opening paragraph under the heading** The art of music curation is born from a unique mix of talent and experience; the ability to hear music differently, to predict trends, to see hidden connections, is the essence of what makes humans connect through music. | **Opening paragraph under the heading** Resomix is a music discovery tool for curators. One reference track becomes the starting point for a ranked set of tracks that share its sound, whatever their genre, era or chart position. The art of music curation is born from a unique mix of talent and experience; the ability to hear music differently, to predict trends, to see hidden connections, is the essence of what makes humans connect through music. |
| **Second paragraph of “Expand your curation with Resomix”** By analysing the structural, harmonic, rhythmic, timbral, and emotional qualities of a reference track, PYXIS-1 is designed to discover new connections between songs, hidden underneath the surface of the genres the songs naturally fall into. | **Second paragraph of “Expand your curation with Resomix”** By analysing the structural, harmonic, rhythmic, timbral, and emotional qualities of a reference track, Resomix's PYXIS-1 engine is designed to discover new connections between songs, hidden underneath the surface of the genres the songs naturally fall into. |
| **Questions section** There was none. | **Questions section, added at the bottom before the call to action** Heading: Questions curators ask about Resomix<br><br>**How do I find songs that fit a playlist's mood?**<br>Pick the track that already has the mood and use it as the reference. Resomix returns candidates that share its energy, timbre and structure, so the playlist flows by sound rather than by tag.<br><br>**Can I save a shortlist?**<br>Yes. Add results to a working shortlist and save it as a playlist in Resomix, then keep listening and reviewing from there.<br><br>**Does it recommend only what is already popular?**<br>No. Ranking is by measured sonic relationship, so a track from another decade or genre can sit next to a recent release when they were born from the same feeling.<br><br>**Can I upload my own reference track?**<br>Yes. Upload an MP3, WAV, FLAC or AIFF. Resomix processes it privately and deletes the source audio no later than 24 hours after upload or analysis. |

## Producers

https://resomix.com/solutions/producers

| Before | After |
|---|---|
| **Search description** Inspect arrangement, energy and timbre in your own recording, then explore sonically related references. Evidence for decisions that stay creatively yours. | **Search description** Resomix helps producers decode a reference track. Inspect arrangement, energy and timbre, then explore sonically related music. The creative decision is yours. |
| **Opening paragraph under the heading** Resomix uses the PYXIS-1 analytical engine to examine 70+ musical characteristics across rhythm, harmony, timbre, structure and energy, then surfaces sonically related tracks that can unlock new production ideas. | **Opening paragraph under the heading** Resomix is a reference-analysis and discovery tool for producers. It uses the PYXIS-1 analytical engine to examine 70+ musical characteristics across rhythm, harmony, timbre, structure and energy, then surfaces sonically related tracks that can unlock new production ideas. |
| **Questions section** There was none. | **Questions section, added at the bottom before the call to action** Heading: Questions producers ask about Resomix<br><br>**How do I analyse a reference track?**<br>Upload it to Resomix and open Track Intelligence. You get structure, energy journey, tempo, key, loudness, timbre and spectral character, each read from the audio and shown with confidence where it applies.<br><br>**Can I upload my own unfinished track?**<br>Yes. It is processed privately, never used to train PYXIS-1, and deleted no later than 24 hours after upload or analysis.<br><br>**What does Resomix measure in a track?**<br>More than 70 audio characteristics across rhythm, harmony, timbre, structure and energy. Resomix's PYXIS-1 engine combines them into one sonic profile, which is what it compares when it looks for related music.<br><br>**Does Resomix generate music or tell me what to change?**<br>No. It surfaces relationships and evidence. What to study, reinterpret or leave behind stays your decision. |

## Trust, Rights and Security

https://resomix.com/trust

| Before | After |
|---|---|
| **Search description** User uploads are deleted within 24 hours. Partner catalogues stay inside private, partner-scoped indexes. No training on your content. No generated audio. | **Search description** How Resomix handles audio. Uploads are deleted within 24 hours, partner catalogues stay in private indexes, and your audio is never used for training. |

## Contact

https://resomix.com/contact

| Before | After |
|---|---|
| **Search description** Reach the Resomix team in Thessaloniki for product support, partner and catalogue enquiries, or press. We reply from support@resomix.com within the beta. | **Search description** Reach the Resomix team in Thessaloniki for product support, partner and catalogue enquiries, or press. Write to support@resomix.com and we will get back to you. |

## Pages we have not touched yet, and what they need

The questions sections were approved for the product and solution pages, so those eleven are done.
This is everything else, with what I would do and how long it takes.

| Page or site | Where it stands | What I suggest | Time |
|---|---|---|---|
| Developers | Opening paragraph and description updated. No questions section | Add it. Five questions are already written. This page is our answer to "best audio analysis API for music", one of the questions we are never named in, so of everything left this is the one I would do first | 30 min |
| Home | Opening paragraph and description updated. No questions section | Add it. Four questions are written, covering "what is Resomix", "how do I find music by sound" and whether we are a song-identification app | 30 min |
| Partners | Opening paragraph and description updated. No questions section | Add the three short questions already written about how to start and what a pilot involves | 20 min |
| Private Catalogue Pilot | Opening paragraph and description updated. No questions section | Add the three questions already written about what a partner brings and what they get back | 20 min |
| About | Unchanged. It already names Resomix throughout and reads well | Optional. Three questions, now drafted, answering who builds Resomix and where, whether it is a streaming service, and what it deliberately does not do. They are kept different from the Home and Product questions so the pages do not repeat each other | 30 min |
| Trust, Rights and Security | Description updated, and its existing question list is now declared to assistants | Nothing further | none |
| Pricing | Untouched. Its wording does not live with the other page copy, it comes from a component shared with the app | Optional. A short questions block answering whether Resomix is free and what Pro adds. Because of where its wording lives, it needs a home for the new text first, so it is a longer job than the others | 45 min to 1 h |
| Contact and Waitlist | Descriptions fine | Nothing further | none |
| The app, beta.resomix.com | Deliberately kept out of search | Nothing | none |
| Journal, blog.resomix.com | Yours and Marco's. The site intro explains sound-first discovery well, though no sentence says "Resomix is" | Worth one habit for new articles. Name Resomix in the first paragraph and let the article answer one buyer question outright. The report's cheapest gain is the seventeen questions we never appear in | your call |
| Developer hub, api-docs.resomix.com | Assistants fetched its sitemap twelve times in one day, so they do read it. When I requested the page, only the title came back, which usually means the content is drawn by JavaScript, and assistants do not run JavaScript | Worth checking properly. If that is what is happening, the hub is invisible to them, which matters because it is our best evidence for the API questions | 30 min to check |
| Machine-readable "software" label on Sonic Discovery and Track Intelligence | Waiting on your decision | Adds a hidden label saying each page describes a working product. Invisible on the page | 30 min |

Doing the four pages with questions already written comes to about 1 hour 40 minutes. Adding About
makes it about 2 hours 10 minutes. I checked each of these against the site's code, and all of them
fit the layout we already built for the other eleven pages, so nothing new has to be designed.
