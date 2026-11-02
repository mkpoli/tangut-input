<script>
  // The frame: the bar with the finders, the text being written, the finder of the page, and the
  // card of the open character beside it (a sheet over it on a phone).
  import { db, load } from './lib/db.svelte.js'
  import { route, go, PAGES } from './lib/route.svelte.js'
  import { ui, applyTangut, applyTheme, cycleTheme, setTangut, TANGUT_FACES } from './lib/ui.svelte.js'
  import { toast } from './lib/clip.svelte.js'
  import { i18n, LOCALES, setLocale, t } from './lib/i18n.svelte.js'
  import { applySeo } from './lib/seo.js'
  import Writing from './ui/Writing.svelte'
  import Card from './ui/Card.svelte'
  import Find from './pages/Find.svelte'
  import Cangjie from './pages/Cangjie.svelte'
  import Sijiao from './pages/Sijiao.svelte'
  import Reading from './pages/Reading.svelte'
  import Draw from './pages/Draw.svelte'
  import Meaning from './pages/Meaning.svelte'
  import Parts from './pages/Parts.svelte'
  import About from './pages/About.svelte'

  load()
  applyTheme()
  applyTangut()

  let fontMenu = $state(false)
  let langMenu = $state(false)
  /** The phone's tab strip, scrolled to keep the current finder in view. @type {HTMLElement | null} */
  let tabs = $state(null)

  $effect(() => {
    void route.page
    applySeo(route.page)
    tabs?.querySelector('a.on')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  })

  /** @param {MouseEvent} event @param {import('./lib/route.svelte.js').Page} page */
  function nav(event, page) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    go(page)
  }

  /** `/` focuses the page's input from anywhere outside a field. @param {KeyboardEvent} event */
  function keys(event) {
    const target = /** @type {HTMLElement} */ (event.target)
    const typing = target.closest('input, textarea, [contenteditable]')
    if (event.key === '/' && !typing) {
      const input = /** @type {HTMLElement | null} */ (document.querySelector('[data-primary]'))
      if (input) { event.preventDefault(); input.focus() }
    }
    if (event.key === 'Escape' && ui.sheet) ui.sheet = false
  }

  const THEMES = $derived({ auto: t('theme.auto'), light: t('theme.light'), dark: t('theme.dark') })
</script>

<svelte:window onkeydown={keys} />

<div class="shell">
  <header class="top">
    <a class="mark" href="/" onclick={event => nav(event, '')} aria-label={t('app.home')}>
      <span class="badge tg" aria-hidden="true">𘅤</span>
      <span class="name">{t('app.name')}</span>
    </a>
    <nav class="finders" aria-label={t('nav.label')}>
      {#each PAGES as page (page.path)}
        <a href="/{page.path}" class:on={route.page === page.path} aria-current={route.page === page.path ? 'page' : undefined}
          title={t(page.hint)} onclick={event => nav(event, page.path)}>{t(page.label)}</a>
      {/each}
    </nav>
    <div class="aside">
      <a href="/about" class="about" class:on={route.page === 'about'} onclick={event => nav(event, 'about')}>{t('nav.sources')}</a>
      <div class="font-pick">
        <button class="btn ghost face" type="button" aria-haspopup="listbox" aria-expanded={langMenu}
          title={t('lang.label')} onclick={() => { langMenu = !langMenu }}><span class="face-name">{LOCALES.find(locale => locale.key === i18n.locale)?.name}</span></button>
        {#if langMenu}
          <ul class="font-menu" role="listbox" aria-label={t('lang.label')}>
            {#each LOCALES as locale (locale.key)}
              <li><button type="button" role="option" aria-selected={i18n.locale === locale.key} class:on={i18n.locale === locale.key}
                lang={locale.key} onclick={() => { setLocale(locale.key); langMenu = false }}><span>{locale.name}</span></button></li>
            {/each}
          </ul>
        {/if}
      </div>
      <div class="font-pick">
        <button class="btn ghost face" type="button" aria-haspopup="listbox" aria-expanded={fontMenu}
          title={t('font.label')} onclick={() => { fontMenu = !fontMenu }}><span class="tg sample" aria-hidden="true">𘅤</span><span class="face-name">{t(TANGUT_FACES.find(face => face.key === ui.tangut)?.label ?? 'font.serif')}</span></button>
        {#if fontMenu}
          <ul class="font-menu" role="listbox" aria-label={t('font.label')}>
            {#each TANGUT_FACES as face (face.key)}
              <li><button type="button" role="option" aria-selected={ui.tangut === face.key} class:on={ui.tangut === face.key}
                onclick={() => { setTangut(face.key); fontMenu = false }}><span class="tg sample" style:font-family={face.family} aria-hidden="true">𗀀</span><span>{t(face.label)}</span></button></li>
            {/each}
          </ul>
        {/if}
      </div>
      <button class="btn ghost theme" type="button" onclick={cycleTheme} title={THEMES[ui.theme]} aria-label={THEMES[ui.theme]}>
        {#if ui.theme === 'light'}
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="currentColor"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7"/></g></svg>
        {:else if ui.theme === 'dark'}
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1Z" fill="currentColor"/></svg>
        {:else}
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor"/></svg>
        {/if}
      </button>
    </div>
  </header>

  <Writing />

  {#if db.status === 'failed'}
    <p class="fault">{t('app.failed')}</p>
  {:else}
    <div class="body" class:about={route.page === 'about'}>
      <main class="finder" aria-label={t(PAGES.find(p => p.path === route.page)?.label ?? 'nav.sources')}>
        {#if route.page === ''}<Find />
        {:else if route.page === 'meaning'}<Meaning />
        {:else if route.page === 'cangjie'}<Cangjie />
        {:else if route.page === 'sijiao'}<Sijiao />
        {:else if route.page === 'reading'}<Reading />
        {:else if route.page === 'draw'}<Draw />
        {:else if route.page === 'parts'}<Parts />
        {:else}<About />{/if}
      </main>
      {#if route.page !== 'about'}
        <aside class="card" class:open={ui.sheet} aria-label={t('card.label')}>
          <Card />
        </aside>
      {/if}
    </div>
  {/if}

  <nav class="tabs" aria-label={t('nav.label')} bind:this={tabs}>
    {#each PAGES as page (page.path)}
      <a href="/{page.path}" class:on={route.page === page.path} aria-current={route.page === page.path ? 'page' : undefined}
        onclick={event => nav(event, page.path)}>{t(page.label)}</a>
    {/each}
  </nav>

  <div class="toast" role="status" aria-live="polite">{#if toast.message}<span>{toast.message}</span>{/if}</div>
</div>

<style>
  .shell{min-height:100dvh;display:flex;flex-direction:column}
  .top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:22px;height:var(--top);padding:0 18px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  .mark{display:flex;align-items:center;gap:9px;color:var(--ink);text-decoration:none}
  .badge{display:grid;place-items:center;width:30px;height:30px;border-radius:7px;background:var(--accent);color:var(--on-accent);font-size:21px}
  .name{font-family:var(--serif);font-size:18px;font-weight:600;letter-spacing:.005em}
  .finders{display:flex;gap:2px}
  .finders a,.about{padding:6px 11px;border-radius:7px;color:var(--ink-2);text-decoration:none;font-size:13.5px;font-weight:500}
  .finders a:hover,.about:hover{background:var(--hover);color:var(--ink)}
  .finders a.on,.about.on{background:var(--ink);color:var(--bg)}
  .aside{margin-left:auto;display:flex;align-items:center;gap:4px}
  .font-pick{position:relative}
  .face{display:flex;align-items:center;gap:6px;padding:6px 9px}
  .sample{font-size:16px;line-height:1}
  .face-name{font-size:12.5px;color:var(--ink-2)}
  .font-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:30;margin:0;padding:4px;list-style:none;min-width:180px;border:1px solid var(--line);border-radius:10px;background:var(--surface);box-shadow:var(--lift)}
  .font-menu button{display:flex;align-items:center;gap:9px;width:100%;padding:7px 9px;border:0;border-radius:7px;background:none;text-align:left;font-size:13px}
  .font-menu button:hover{background:var(--hover)}
  .font-menu button.on{background:var(--ink);color:var(--bg)}
  .font-menu .sample{font-size:19px}
  .theme{padding:0 8px}

  .body{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 440px;align-items:start}
  .body.about{grid-template-columns:minmax(0,1fr)}
  .finder{min-width:0;padding:22px 26px 60px}
  .card{position:sticky;top:var(--top);height:calc(100dvh - var(--top));overflow:auto;border-left:1px solid var(--line);background:var(--surface);overscroll-behavior:contain}
  .fault{margin:60px auto;max-width:36em;color:var(--accent-ink)}
  .tabs{display:none}

  .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;pointer-events:none}
  .toast span{display:block;padding:8px 14px;border-radius:999px;background:var(--ink);color:var(--bg);font-size:13px;box-shadow:var(--lift)}

  @media (max-width:1180px){.body{grid-template-columns:minmax(0,1fr) 380px}}
  @media (max-width:900px){
    .top{gap:10px;padding:0 14px}
    .finders,.about,.face-name{display:none}
    .body{grid-template-columns:minmax(0,1fr)}
    .finder{padding:16px 14px 90px}
    .card{position:fixed;inset:0;top:0;height:100dvh;z-index:40;border:0;transform:translateY(100%);transition:transform .22s ease;visibility:hidden}
    .card.open{transform:none;visibility:visible}
    /* Seven finders do not fit a phone; the strip scrolls sideways and keeps the current one in view. */
    .tabs{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;gap:2px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(10px);border-top:1px solid var(--line);overflow-x:auto;scrollbar-width:none;scroll-behavior:smooth}
    .tabs::-webkit-scrollbar{display:none}
    .tabs a{flex:0 0 auto;padding:9px 11px;border-radius:8px;text-align:center;color:var(--ink-2);text-decoration:none;font-size:13px;font-weight:500;white-space:nowrap}
    .tabs a.on{background:var(--ink);color:var(--bg)}
    .toast{bottom:84px}
  }
  @media (prefers-reduced-motion:reduce){.card{transition:none}}
</style>
