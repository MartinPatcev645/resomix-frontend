/**
 * Content negotiation for Markdown.
 *
 * NOT CURRENTLY ACTIVE. READ THIS FIRST.
 * --------------------------------------
 * Deployed 18 September 2026 and Cloudflare did not pick it up. `Accept: text/markdown` against
 * resomix.com still returns `text/html`, and a cache purge changed nothing.
 *
 * The cause is where Pages looks for functions. It looks in the project's ROOT DIRECTORY, and this
 * project almost certainly builds from the repository root, because its build command is the
 * root-level `pnpm build:landing` script. So Pages looks for `<repo root>/functions/` and never
 * sees this file.
 *
 * Moving it to the repository root would work and is the wrong fix: the webapp, admin and embed
 * Pages projects build from that same root, so all three would inherit this middleware and turn
 * from plain static-asset projects into Functions projects.
 *
 * The file is kept because it is correct and because changing the project's root directory to
 * `apps/landing` would activate it as it stands. The recommended route instead is a Cloudflare URL
 * Rewrite transform rule, which needs no code and touches no other project. Either way, see
 * docs/AGENT_READINESS_FINDINGS.md.
 *
 * Nothing depends on this file. The Markdown twins are live and reachable at their own `.md`
 * addresses, every page advertises one, and llms.txt explains both routes.
 *
 * WHAT IT DOES, WHEN ACTIVE
 * -------------------------
 * A request that asks for `text/markdown` gets the Markdown twin of the page. Everything else,
 * which is every browser and every search crawler, is passed straight through untouched.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE
 * ---------------------------------------
 * On Cloudflare Pages, `_middleware` runs in front of EVERY request to this project, static assets
 * included. If it throws, the site does. That is why this file does as little as possible:
 *
 *   - It never generates anything. The `.md` files are written at build time by
 *     tooling/markdownForAgents.ts, so all this does is rewrite a path to a file that already
 *     exists.
 *   - Every branch that is not "this request explicitly asked for Markdown and a twin exists"
 *     returns `next()`, which is the untouched original response.
 *   - The whole body is wrapped in try/catch, and the catch also returns `next()`. A bug here
 *     costs the Markdown feature, not the website.
 *
 * If this ever needs to be switched off in a hurry, delete the file and redeploy. Nothing else
 * depends on it. The `.md` files stay reachable at their own addresses either way, and every page
 * advertises its twin with a `<link rel="alternate" type="text/markdown">` tag.
 */

interface MiddlewareContext {
  request: Request
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>
}

/** Paths that are never a page, so never have a Markdown twin. */
const NEVER_A_PAGE = ['/assets/', '/scripts/', '/fonts/', '/auth/', '/.well-known/', '/cdn-cgi/']

/**
 * Does this client prefer Markdown over HTML?
 *
 * Deliberately strict. A browser sends `text/html,application/xhtml+xml,...` and never mentions
 * Markdown, so it falls through on the first test. An agent that lists both is only served Markdown
 * when it actually ranked Markdown at least as high, which is what the q value is for.
 */
function prefersMarkdown(accept: string | null): boolean {
  if (!accept || !accept.includes('text/markdown')) return false

  const quality = (type: string): number => {
    for (const part of accept.split(',')) {
      const [media, ...params] = part.trim().split(';')
      if (media.trim() !== type) continue
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      if (!q) return 1
      const value = Number.parseFloat(q.slice(2))
      return Number.isFinite(value) ? value : 1
    }
    return 0
  }

  const markdown = quality('text/markdown')
  if (markdown <= 0) return false
  return markdown >= quality('text/html')
}

/** `/` becomes `/index.md`, `/product/sonic-discovery` becomes `/product/sonic-discovery.md`. */
function markdownPathFor(pathname: string): string | null {
  if (NEVER_A_PAGE.some((prefix) => pathname.startsWith(prefix))) return null

  const clean = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (clean === '' || clean === '/') return '/index.md'

  /* Anything already carrying an extension is a file, not a route. */
  if (/\.[a-z0-9]+$/i.test(clean)) return null
  return `${clean}.md`
}

export const onRequest = async (context: MiddlewareContext): Promise<Response> => {
  try {
    const { request, next } = context

    if (request.method !== 'GET' && request.method !== 'HEAD') return next()
    if (!prefersMarkdown(request.headers.get('accept'))) return next()

    const url = new URL(request.url)
    const markdownPath = markdownPathFor(url.pathname)
    if (!markdownPath) return next()

    const twin = new URL(url.toString())
    twin.pathname = markdownPath
    const response = await next(twin.toString())

    /* No twin for this route, or something else went wrong fetching it. Serve the page as normal
       rather than handing back a 404 to a client that asked a perfectly reasonable question. */
    if (!response.ok) return next()

    const headers = new Headers(response.headers)
    headers.set('Content-Type', 'text/markdown; charset=utf-8')
    headers.set('Content-Location', markdownPath)
    /* The same address now answers with two different bodies. Both of these are required so that
       nothing between here and the client serves Markdown to a browser. */
    headers.set('Vary', 'Accept')
    headers.set('Cache-Control', 'no-store')

    return new Response(response.body, { status: 200, headers })
  } catch {
    return context.next()
  }
}
