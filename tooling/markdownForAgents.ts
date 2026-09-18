import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * A Markdown twin of every page, written at build time.
 *
 * WHY
 * ---
 * An agent reading a marketing page has to wade through the nav, the cookie banner, the footer and
 * several thousand utility classes to find four paragraphs of prose. Cloudflare sells the fix as a
 * switch ("Markdown for Agents") but only on the Pro plan, which this site is not on, so we build
 * it. Their own guidance is simply that a request asking for Markdown should get Markdown while
 * browsers keep getting HTML.
 *
 * HOW, AND WHY THIS WAY
 * ---------------------
 * The Markdown is generated HERE, at build time, from the prerendered HTML that is already being
 * written. Two consequences, both deliberate:
 *
 *   1. It cannot drift from the page. It is a conversion of the exact bytes a browser receives, not
 *      a second rendering of the same data through a different path.
 *   2. Serving it needs no work at runtime. The Pages function that answers an
 *      `Accept: text/markdown` request only has to rewrite a path to a file that already exists,
 *      which is about fifteen lines and cannot fail in an interesting way. A function that
 *      generated Markdown per request would be running conversion code in front of every visitor.
 *
 * The conversion starts at `<main>` and ends at the last `</main>`, so the site header, the four
 * nav blocks, the beta banner and the footer are all left out. That chrome is exactly what the
 * ShelfSignal report in September 2026 found assistants stripping anyway, and repeating it on every
 * page is what made the pages expensive to read in the first place.
 *
 * Nine pages currently render two `<main>` elements, which is why the end boundary is the LAST
 * closing tag rather than the first. That duplication is a real markup fault worth fixing on its
 * own; this step is written to be correct either way rather than to depend on it.
 */

interface MarkdownForAgentsOptions {
  /** Route paths to convert, e.g. `/`, `/about`. Each must already have a prerendered HTML file. */
  routes: string[]
  /** The build output directory, whose HTML files this reads and whose `.md` files it writes. */
  clientDir: string
  /** Absolute site origin, used to turn relative hrefs into links an agent can follow. */
  origin: string
}

/** Elements whose content is presentation or interaction, never prose. */
const DROP = new Set([
  'script',
  'style',
  'svg',
  'noscript',
  'template',
  'form',
  'input',
  'select',
  'textarea',
  'option',
  'button',
  'iframe',
  'canvas',
  'video',
  'audio',
])

/** Elements that never have a closing tag. */
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  middot: '·',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  times: '×',
  deg: '°',
  eacute: 'é',
}

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCodePoint(parseInt(body.slice(2), 16))
    }
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10))
    return ENTITIES[body] ?? whole
  })
}

interface Element {
  tag: string
  attrs: Record<string, string>
  children: Node[]
}
type Node = Element | { text: string }

const isText = (node: Node): node is { text: string } => 'text' in node

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of source.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*"([^"]*)")?/g)) {
    if (m[1]) attrs[m[1].toLowerCase()] = m[2] ?? ''
  }
  return attrs
}

/**
 * Parse well-formed HTML into a tree.
 *
 * This only has to cope with React's server output, which closes every element it opens and never
 * relies on implied end tags, so a stack is enough and a real parser would be a dependency for no
 * gain. Anything it cannot make sense of is skipped rather than guessed at.
 */
function parse(source: string): Element {
  /* React separates adjacent text expressions with an empty comment, so the raw markup is full of
     `<!-- -->`. Left in, they end up as literal text in the Markdown. */
  const html = source.replace(/<!--[\s\S]*?-->/g, '')
  const root: Element = { tag: '#root', attrs: {}, children: [] }
  const stack: Element[] = [root]
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|[^>])*?)(\/?)>/g

  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = tagRe.exec(html)) !== null) {
    const [whole, closing, rawName, rawAttrs, selfClosing] = match
    const tag = rawName.toLowerCase()

    const text = html.slice(cursor, match.index)
    if (text) stack[stack.length - 1].children.push({ text })
    cursor = match.index + whole.length

    if (closing) {
      /* Unwind to the matching open tag. A stray close tag leaves the stack alone rather than
         popping something it does not own. */
      const depth = stack.map((e) => e.tag).lastIndexOf(tag)
      if (depth > 0) stack.length = depth
      continue
    }

    if (DROP.has(tag)) {
      /* Skip the whole subtree, including nested copies of the same tag. */
      if (!VOID.has(tag) && !selfClosing) {
        let open = 1
        const inner = new RegExp(`<(/?)${tag}\\b`, 'gi')
        inner.lastIndex = cursor
        let hit: RegExpExecArray | null
        while (open > 0 && (hit = inner.exec(html)) !== null) {
          open += hit[1] ? -1 : 1
        }
        const end = html.indexOf('>', inner.lastIndex - 1)
        cursor = end === -1 ? html.length : end + 1
        tagRe.lastIndex = cursor
      }
      continue
    }

    const element: Element = { tag, attrs: parseAttrs(rawAttrs), children: [] }
    stack[stack.length - 1].children.push(element)
    if (!VOID.has(tag) && !selfClosing) stack.push(element)
  }

  const tail = html.slice(cursor)
  if (tail) root.children.push({ text: tail })
  return root
}

/** Inline content, rendered to a single line of Markdown. */
function inline(nodes: Node[], origin: string): string {
  let out = ''
  let previousWasElement = false

  /*
   * Two elements can sit side by side with no whitespace between them, because CSS is what
   * separates them on screen. `<span>Choose a reference track</span><span>Search for a track</span>`
   * is a real example from the steps list, and concatenating it gives one run-on word. A single
   * space goes in when both sides end and start with a word character, which leaves punctuation
   * coming from a text node alone.
   */
  const join = (fragment: string) => {
    if (previousWasElement && /\w$/.test(out) && /^\w/.test(fragment)) out += ' '
    out += fragment
  }

  for (const node of nodes) {
    if (isText(node)) {
      out += decode(node.text).replace(/\s+/g, ' ')
      previousWasElement = false
      continue
    }
    if (node.attrs['aria-hidden'] === 'true') continue

    const inner = inline(node.children, origin)
    switch (node.tag) {
      case 'br':
        out += '\n'
        break
      case 'strong':
      case 'b':
        join(inner.trim() ? `**${inner.trim()}**` : '')
        break
      case 'em':
      case 'i':
        join(inner.trim() ? `*${inner.trim()}*` : '')
        break
      case 'code':
        join(inner.trim() ? `\`${inner.trim()}\`` : '')
        break
      case 'a': {
        const href = node.attrs.href
        const label = inner.trim()
        if (!label) break
        if (!href || href.startsWith('#')) {
          join(label)
          break
        }
        const url = href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? '' : '/'}${href}`
        join(`[${label}](${url})`)
        break
      }
      default:
        join(inner)
    }
    previousWasElement = true
  }
  return out
}

/** Block content, rendered to Markdown. */
function block(nodes: Node[], origin: string, depth = 0): string {
  const parts: string[] = []

  for (const node of nodes) {
    /*
     * Loose text, sitting in a div or a span with no content element around it, is skipped.
     *
     * This is the rule that decides what an agent reads. These pages carry visual schematics built
     * from plain divs, mock playlists with invented track names and percentages, and the same panel
     * again in a mobile variant. All of it is real text in the DOM and none of it is prose. Taking
     * only what a content element wraps leaves the headings, the paragraphs, the lists and the
     * questions, which is the whole point of serving Markdown at all.
     */
    if (isText(node)) continue
    if (node.attrs['aria-hidden'] === 'true') continue

    switch (node.tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const text = inline(node.children, origin).trim()
        if (text) parts.push(`${'#'.repeat(Number(node.tag[1]))} ${text}`)
        break
      }
      case 'p':
      case 'figcaption': {
        const text = inline(node.children, origin).trim()
        if (text) parts.push(text)
        break
      }
      case 'ul':
      case 'ol': {
        const items = node.children
          .filter((c): c is Element => !isText(c) && c.tag === 'li')
          .map((li, i) => {
            const text = inline(li.children, origin).trim()
            return text ? `${node.tag === 'ol' ? `${i + 1}.` : '-'} ${text}` : ''
          })
          .filter(Boolean)
        if (items.length) parts.push(items.join('\n'))
        break
      }
      case 'dl': {
        const lines: string[] = []
        for (const child of node.children) {
          if (isText(child)) continue
          const text = inline(child.children, origin).trim()
          if (!text) continue
          if (child.tag === 'dt') lines.push(`**${text}**`)
          else if (child.tag === 'dd') lines.push(`${text}\n`)
        }
        if (lines.length) parts.push(lines.join('\n'))
        break
      }
      case 'pre': {
        const text = inline(node.children, origin).trim()
        if (text) parts.push(`\`\`\`\n${text}\n\`\`\``)
        break
      }
      case 'li':
        /* A list item outside a list. Treat it as one anyway rather than dropping the text. */
        {
          const text = inline(node.children, origin).trim()
          if (text) parts.push(`- ${text}`)
        }
        break
      default: {
        const nested = block(node.children, origin, depth + 1)
        if (nested) parts.push(nested)
      }
    }
  }

  return parts.filter(Boolean).join('\n\n')
}

/** The page content, from the first `<main>` to the last `</main>`. */
function mainOf(html: string): string | null {
  const open = html.search(/<main[\s>]/)
  if (open === -1) return null
  const close = html.lastIndexOf('</main>')
  if (close === -1 || close < open) return null
  return html.slice(html.indexOf('>', open) + 1, close)
}

const read = (html: string, re: RegExp) => html.match(re)?.[1] ?? ''

/** `/` becomes `index`, `/product/sonic-discovery` becomes `product/sonic-discovery`. */
const fileFor = (route: string) => (route === '/' ? 'index' : route.replace(/^\//, ''))

export function markdownForAgents(options: MarkdownForAgentsOptions): {
  name: string
  apply: 'build'
  closeBundle: { sequential: true; order: 'post'; handler(): void }
} {
  const { routes, clientDir, origin } = options

  /*
   * `sequential` and `order: 'post'` are both load-bearing. `closeBundle` is a parallel hook, so
   * the first version of this plugin started converting while prerenderBodies was still rendering
   * and found no <main> on any page. It reported twenty skipped routes and a green build, which is
   * the worst kind of wrong. This form makes the hook wait its turn.
   */
  return {
    name: 'markdown-for-agents',
    apply: 'build',
    closeBundle: {
      sequential: true,
      order: 'post',
      handler() {
      let written = 0
      let bytes = 0
      const skipped: string[] = []

      for (const route of routes) {
        const base = fileFor(route)
        const htmlPath = path.resolve(clientDir, `${base}.html`)
        if (!existsSync(htmlPath)) {
          skipped.push(`${route} (no HTML)`)
          continue
        }

        const html = readFileSync(htmlPath, 'utf8')
        const main = mainOf(html)
        if (!main) {
          /* Redirect and hand-off shells have no <main> and no prose. Nothing to convert, and an
             empty .md would be worse than none. */
          skipped.push(route)
          continue
        }

        const title = decode(read(html, /<title>([\s\S]*?)<\/title>/i)).trim()
        const description = decode(
          read(html, /<meta\s+name="description"\s+content="([^"]*)"/i),
        ).trim()
        const canonical = read(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i)

        const body = block(parse(main).children, origin)
        if (!body.trim()) {
          skipped.push(`${route} (empty after conversion)`)
          continue
        }

        const doc = [
          `<!-- Markdown for agents. Generated at build time from ${canonical || origin + route} -->`,
          '',
          `> ${description}`,
          '',
          body.replace(/\n{3,}/g, '\n\n').trim(),
          '',
          '---',
          '',
          `Source: ${canonical || origin + route}`,
          `Site guide for AI systems: ${origin}/llms.txt`,
          '',
        ].join('\n')

        const mdPath = path.resolve(clientDir, `${base}.md`)
        writeFileSync(mdPath, doc)
        written += 1
        bytes += Buffer.byteLength(doc)

        /* Tell a reader of the HTML that the Markdown exists. The Pages function handles clients
           that ask by `Accept` header; this serves the ones that look at the document. */
        if (!html.includes('rel="alternate" type="text/markdown"')) {
          const tag = `    <link rel="alternate" type="text/markdown" href="/${base}.md" title="${title.replace(/"/g, '&quot;')} as Markdown" />\n`
          writeFileSync(htmlPath, html.replace('</head>', `${tag}  </head>`))
        }
      }

        const kib = Math.round(bytes / 1024)
        console.log(
          `  markdown          ${written} routes, ${kib} KiB` +
            (skipped.length ? `  (skipped: ${skipped.join(', ')})` : ''),
        )
      },
    },
  }
}
