// Every page the app routes to and every address the sitemap lists answers with its own head, so
// each is named in `PAGE_SEO` and runs the worker first instead of reaching the static shell.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { PAGE_SEO, seoOf } from '../app/lib/seo.js'
import worker from '../app/worker.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const indexHtml = read('../app/index.html')
const routes = [...read('../app/lib/route.svelte.js').matchAll(/path: '(\w*)'/g)].map(match => match[1])
const sitemap = [...read('../app/public/sitemap.xml').matchAll(/<loc>https:\/\/tangut\.mkpo\.li\/(\w*)<\/loc>/g)].map(match => match[1])
const config = JSON.parse(read('../wrangler.jsonc').replace(/^\s*\/\/.*$/gm, ''))

test('every routed page and sitemap address has a head of its own', () => {
  expect(routes.length).toBeGreaterThan(15)
  for (const page of new Set([...routes, ...sitemap])) expect(PAGE_SEO[page], page).toBeDefined()
})

test('the worker runs first for every page with a head', () => {
  const first = new Set(config.assets.run_worker_first)
  for (const page of Object.keys(PAGE_SEO)) {
    expect(first.has(`/${page}`), `/${page}`).toBe(true)
    if (page) expect(first.has(`/${page}/`), `/${page}/`).toBe(true)
  }
})

test('a page canonical is its own address', () => {
  for (const page of Object.keys(PAGE_SEO)) expect(seoOf(page).url).toBe(`https://tangut.mkpo.li/${page}`)
})

test('a path that is neither a page nor an asset is a 404, not the app', () => {
  expect(config.assets.not_found_handling).toBeUndefined()
})

test('the worker fetches / rather than /index.html and rewrites the page head', async () => {
  const env = {
    ASSETS: {
      async fetch(input) {
        const path = new URL(typeof input === 'string' ? input : input.url).pathname
        if (path === '/index.html') return new Response(null, { status: 307, headers: { location: '/' } })
        if (path === '/') return new Response(indexHtml, { status: 200, headers: { 'content-type': 'text/html' } })
        return new Response('missing', { status: 404 })
      },
    },
  }
  for (const page of ['', 'texts', 'codes', 'dataset', 'ocr']) {
    const response = await worker.fetch(new Request(`https://tangut.mkpo.li/${page}`), /** @type {any} */ (env))
    expect(response.status, page).toBe(200)
    const body = await response.text()
    const { title, url } = seoOf(page)
    expect(body, page).toContain(`<title>${title}</title>`)
    expect(body, page).toContain(`<link rel="canonical" href="${url}">`)
  }
})
