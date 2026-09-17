# AI Visibility Work on resomix.com

Prepared for George on 17 September 2026.
This covers the work done in response to Vladimir's ShelfSignal report of 15 September 2026 and
his follow-up list of seven fixes.

## What the report found

Vladimir asked five AI assistants twenty buyer questions, five times each, for 500 answers.

| Measure | Result on 15 September |
|---|---|
| Share of voice | 2%, named in 8 of 500 answers |
| Rank | 91 of 735 brands |
| Named first | Never |
| By assistant | Perplexity 8%. ChatGPT, Claude, Grok and Gemini 0% |
| Homepage | Read in 15 answers, named in 8 |
| Sonic Discovery page | Read in 2 answers, named in 0 |

The important finding was the last row. Assistants were reaching our pages and reading them, then
leaving without naming us. When we looked at why, the Sonic Discovery page said "PYXIS-1" ten
times and "Resomix" once, and the Track Intelligence page never said "Resomix" in its text at all.
An assistant strips the logo, the menu and the footer before it reads, so what was left looked
like a page about a thing called PYXIS-1. The only sentence on the site that began "Resomix is"
was the beta notice about bugs.

So the problem was never that we were blocked or had too little content. The pages did not say,
in plain words, who we are and what we do.

## What we did

Everything below keeps the existing tone and design. Most of it is small edits to text that was
already there.

| Change | Where |
|---|---|
| A sentence under each main heading that says what Resomix is, in the words buyers use, such as "music similarity search tool" and "track analysis software" | 15 pages |
| "Resomix's PYXIS-1 engine" wherever a page first mentions PYXIS-1, so the engine is always tied to the brand | Every page that mentions it |
| Search descriptions rewritten to name Resomix. The same text is what shows in link previews | 14 pages |
| A questions and answers block, in the words people type into an assistant, 52 questions in total | 4 product pages and 7 solution pages |
| The five steps of Sonic Discovery as plain text under the diagram. They were drawn inside the graphic, where assistants cannot read them | Sonic Discovery |
| The beta notice now opens with what Resomix is, instead of a warning about bugs | Every page, site and app |
| British spelling throughout | Music Publishers |
| Hidden labels that tell a machine what each page is about, including the company details, the services, the API, every question block and the five steps | All pages |
| One address per page. Links with www now land on the right page instead of the homepage, and the version with a trailing slash redirects to the clean one | Whole site |
| The llms.txt file, a short guide to the site for AI systems, rewritten with the buyer phrases and a few plain facts | Site root |

Two things came out of this that are worth knowing.

- **Cloudflare was never blocking the assistants.** We checked every setting and the traffic
  itself. In one day Cloudflare served ChatGPT, Claude, Perplexity and Bing several hundred
  requests, and the numbers show they were reading the site heavily on the day of Vladimir's test.
- **The catalogue size stays private**, as you asked. No number appears anywhere, including in
  the answers about how large a catalogue we can process.

## How this answers Vladimir's list

| Vladimir's fix | Status |
|---|---|
| 1. A sentence under the heading naming the brand | Done on 15 pages |
| 2. Resomix in the search description and the link preview | Done on 14 pages |
| 3. "Resomix (PYXIS-1 engine)" instead of just "PYXIS-1" | Done, in our own wording |
| 4. Diagram steps as plain text | Done on Sonic Discovery |
| 5. FAQ in buyer wording, with the matching hidden labels | Done on 11 pages |
| 6. One address per page, for www and the trailing slash | Done |
| 7. Bing Webmaster Tools and IndexNow | Happens right after the production release |

Two parts of the report are outside the website. New articles for the questions where we do not
appear at all belong to the Journal, which is yours and Marco's. Getting Resomix mentioned on the
sites the assistants quote most, such as Reddit, digdeeper.fm, GitHub and Wikipedia, is outreach.
Both matter, because the report shows assistants quote those sources before they recommend anyone.

## Where it stands

All of it is built, tested and checked on the staging site. It goes live on resomix.com with the
next production release.

## What happens next

1. Production release.
2. Register the site with Bing, which is what ChatGPT and Copilot search, and notify the search
   engines of every changed page.
3. Send Vladimir the go-live date and the list of changed pages below.
4. He runs the same test again two to three weeks later, and we compare against the table at the
   top of this document.

## Changed pages, for Vladimir

```
https://resomix.com/
https://resomix.com/product
https://resomix.com/product/sonic-discovery
https://resomix.com/product/track-intelligence
https://resomix.com/product/catalog-intelligence
https://resomix.com/developers
https://resomix.com/partners
https://resomix.com/partners/pilot
https://resomix.com/trust
https://resomix.com/solutions/record-labels
https://resomix.com/solutions/music-publishers
https://resomix.com/solutions/sync-agencies
https://resomix.com/solutions/music-libraries-sample-providers
https://resomix.com/solutions/djs
https://resomix.com/solutions/music-curators
https://resomix.com/solutions/producers
https://resomix.com/contact
https://resomix.com/llms.txt
```

## Still open with you

- The same kind of question block for Home, Developers, Partners and the Pilot page. The questions
  are written. Developers is the one I would add first, because it is the natural answer to "best
  audio analysis API for music", a question where we currently do not appear.
- The four decisions in the agent readiness document I sent earlier.
- The Journal articles and the outreach described above.
