<script>
  // The frame: the bar with the finders, the text being written, the finder of the page, and the
  // card of the open character beside it (a sheet over it on a phone).
  import { tick } from 'svelte'
  import { db, load } from './lib/db.svelte.js'
  import { route, go, PAGES } from './lib/route.svelte.js'
  import { ui, applyTangut, applyTheme, cycleTheme, setTangut, setReading, TANGUT_FACES } from './lib/ui.svelte.js'
  import { SYSTEMS, systemName, systemTitle } from './lib/reading.js'
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
  import Fanqie from './pages/Fanqie.svelte'
  import Chart from './pages/Chart.svelte'
  import Meaning from './pages/Meaning.svelte'
  import Parts from './pages/Parts.svelte'
  import About from './pages/About.svelte'

  load()
  applyTheme()
  applyTangut()

  let fontMenu = $state(false)
  /** @type {HTMLElement | null} */
  let fontTrigger = $state(null)
  /** @type {HTMLElement | null} */
  let fontList = $state(null)
  /** The phone's tab strip, scrolled to keep the current finder in view. @type {HTMLElement | null} */
  let tabs = $state(null)
  /** On a phone the strip holds the four finders a reader starts from; the rest wait in a sheet. */
  const EXTRAS = new Set(['sijiao', 'fanqie', 'chart', 'draw', 'parts'])
  let menu = $state(false)
  /** @type {HTMLDialogElement | null} */
  let sheet = $state(null)
  /** @type {HTMLElement | null} */
  let moreButton = $state(null)

  $effect(() => {
    void route.page
    applySeo(route.page)
    tabs?.querySelector('a.on')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  })

  // The phone sheet is a real dialog: the browser traps focus in it, closes it on Escape and
  // returns focus to the button that opened it.
  $effect(() => {
    if (!sheet) return
    if (menu && !sheet.open) sheet.showModal()
    if (!menu && sheet.open) sheet.close()
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
    if (event.key === 'Escape') {
      if (ui.sheet) ui.sheet = false
      if (fontMenu) closeFont()
    }
  }

  /** Opens the face list and puts the keyboard on the current face. */
  async function openFont() {
    fontMenu = true
    await tick()
    const current = fontList?.querySelector('[aria-selected="true"]')
    ;/** @type {HTMLElement | null} */ (current ?? fontList?.querySelector('button') ?? null)?.focus()
  }

  /** @param {boolean} [restore] */
  function closeFont(restore = true) {
    fontMenu = false
    if (restore) fontTrigger?.focus()
  }

  /** @param {KeyboardEvent} event */
  function fontKeys(event) {
    const entries = [...(fontList?.querySelectorAll('button') ?? [])]
    const at = entries.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement))
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (step) {
      event.preventDefault()
      entries[(at + step + entries.length) % entries.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      ;(event.key === 'Home' ? entries[0] : entries[entries.length - 1])?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeFont()
    } else if (event.key === 'Tab') {
      fontMenu = false
    }
  }

  /** @param {MouseEvent} event */
  function outsideFont(event) {
    if (fontMenu && !(/** @type {HTMLElement} */ (event.target)).closest('.font-pick')) fontMenu = false
  }

  // A menu that sits over the page closes when the pointer goes anywhere else.
  $effect(() => {
    if (!fontMenu) return
    const close = () => { fontMenu = false }
    addEventListener('pointerdown', outsideFont)
    addEventListener('blur', close)
    return () => {
      removeEventListener('pointerdown', outsideFont)
      removeEventListener('blur', close)
    }
  })

  const THEMES = $derived({ auto: t('theme.auto'), light: t('theme.light'), dark: t('theme.dark') })
</script>

<svelte:window onkeydown={keys} />

<div class="shell">
  <header class="top">
    <a class="mark" href="/" onclick={event => nav(event, '')} aria-label={t('app.home')}>
      <span class="badge ui-script" aria-hidden="true">𘅤</span>
      <span class="name">{t('app.name')}</span>
    </a>
    <nav class="finders" aria-label={t('nav.label')}>
      {#each PAGES as page (page.path)}
        <a href="/{page.path}" class:on={route.page === page.path} aria-current={route.page === page.path ? 'page' : undefined}
          title={t(page.hint)} onclick={event => nav(event, page.path)}>{t(page.label)}</a>
      {/each}
      <a class="sources" href="/about" class:on={route.page === 'about'} aria-current={route.page === 'about' ? 'page' : undefined}
        onclick={event => nav(event, 'about')}>{t('nav.sources')}</a>
    </nav>
    <div class="aside">
      <label class="reading" title={t('reading.system')}>
        <span class="ui-visually-hidden">{t('reading.system')}</span>
        <span class="ui-select-wrap">
          <select class="ui-select" data-size="sm" value={ui.reading}
            onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setReading(event.currentTarget.value)}>
            {#each SYSTEMS as entry (entry.key)}<option value={entry.key} title={systemTitle(entry)}>{systemName(entry, i18n.locale)}</option>{/each}
          </select>
        </span>
      </label>
      <label class="lang" title={t('lang.label')}>
        <span class="ui-visually-hidden">{t('lang.label')}</span>
        <span class="ui-select-wrap">
          <select class="ui-select" data-size="sm" value={i18n.locale}
            onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setLocale(/** @type {any} */ (event.currentTarget.value))}>
            {#each LOCALES as locale (locale.key)}<option value={locale.key} lang={locale.key}>{locale.name}</option>{/each}
          </select>
        </span>
      </label>
      <div class="font-pick">
        <button class="ui-button" data-variant="quiet" data-size="icon-sm" type="button" bind:this={fontTrigger}
          aria-label={t('font.label')} aria-haspopup="listbox" aria-expanded={fontMenu}
          title={t(TANGUT_FACES.find(face => face.key === ui.tangut)?.label ?? 'font.serif')}
          onclick={() => { fontMenu ? closeFont(false) : openFont() }}>
          <span class="ui-script sample" aria-hidden="true">𘅤</span>
        </button>
        {#if fontMenu}
          <ul class="ui-menu font-menu" role="listbox" aria-label={t('font.label')} bind:this={fontList} onkeydown={fontKeys}>
            {#each TANGUT_FACES as face (face.key)}
              <li role="none">
                <button type="button" role="option" class="ui-menu-item" aria-selected={ui.tangut === face.key}
                  onclick={() => { setTangut(face.key); closeFont() }}>
                  <span class="ui-script sample" style:font-family={face.family} aria-hidden="true">𗀀</span>
                  <span>{t(face.label)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <button class="ui-button" data-variant="quiet" data-size="icon-sm" type="button" onclick={cycleTheme} title={THEMES[ui.theme]} aria-label={THEMES[ui.theme]}>
        {#if ui.theme === 'light'}
          <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="currentColor"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7"/></g></svg>
        {:else if ui.theme === 'dark'}
          <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1Z" fill="currentColor"/></svg>
        {:else}
          <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor"/></svg>
        {/if}
      </button>
    </div>
  </header>

  <Writing />

  {#if db.status === 'failed'}
    <p class="fault">{t('app.failed')}</p>
  {:else}
    <div class="body" class:full={route.page === 'about'}>
      <main class="finder" aria-label={t(PAGES.find(p => p.path === route.page)?.label ?? 'nav.sources')}>
        {#if route.page === ''}<Find />
        {:else if route.page === 'meaning'}<Meaning />
        {:else if route.page === 'cangjie'}<Cangjie />
        {:else if route.page === 'sijiao'}<Sijiao />
        {:else if route.page === 'reading'}<Reading />
        {:else if route.page === 'fanqie'}<Fanqie />
        {:else if route.page === 'chart'}<Chart />
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
      <a href="/{page.path}" class:on={route.page === page.path} class:extra={EXTRAS.has(page.path)}
        aria-current={route.page === page.path ? 'page' : undefined}
        onclick={event => nav(event, page.path)}>{t(page.label)}</a>
    {/each}
    <button class="more" class:on={EXTRAS.has(route.page) || route.page === 'about'} type="button" bind:this={moreButton}
      aria-expanded={menu} aria-haspopup="dialog" onclick={() => { menu = true }}>{t('nav.more')}</button>
  </nav>

  <dialog class="sheet" bind:this={sheet} aria-label={t('nav.label')}
    onclose={() => { menu = false; moreButton?.focus() }}
    onclick={(/** @type {MouseEvent} */ event) => { if (event.target === sheet) menu = false }}>
    <div class="sheet-head">
      <p class="ui-label">{t('nav.more')}</p>
      <button class="ui-button" data-variant="quiet" data-size="icon-sm" type="button" aria-label={t('nav.menuClose')}
        onclick={() => { menu = false }}>×</button>
    </div>
    <div class="sheet-links">
      {#each PAGES.filter(page => EXTRAS.has(page.path) || page.path === '') as page (page.path)}
        <a class="sheet-link" href="/{page.path}" class:on={route.page === page.path} aria-current={route.page === page.path ? 'page' : undefined}
          onclick={event => { menu = false; nav(event, page.path) }}>
          <span class="sheet-name">{t(page.label)}</span><span class="ui-hint">{t(page.hint)}</span>
        </a>
      {/each}
      <a class="sheet-link" href="/about" class:on={route.page === 'about'} aria-current={route.page === 'about' ? 'page' : undefined}
        onclick={event => { menu = false; nav(event, 'about') }}>
        <span class="sheet-name">{t('nav.sources')}</span><span class="ui-hint">{t('nav.sources.hint')}</span>
      </a>
    </div>
    <hr class="ui-menu-separator" />
    <label class="sheet-lang">
      <span class="ui-label">{t('lang.label')}</span>
      <span class="ui-select-wrap">
        <select class="ui-select" value={i18n.locale}
          onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setLocale(/** @type {any} */ (event.currentTarget.value))}>
          {#each LOCALES as locale (locale.key)}<option value={locale.key} lang={locale.key}>{locale.name}</option>{/each}
        </select>
      </span>
    </label>
  </dialog>

  <div class="toast" role="status" aria-live="polite">{#if toast.message}<span class="ui-toast">{toast.message}</span>{/if}</div>
</div>

<style>
  .shell{min-block-size:100dvh;display:flex;flex-direction:column}
  .top{position:sticky;top:0;z-index:var(--ui-z-chrome);display:flex;align-items:center;gap:var(--ui-space-xl);block-size:var(--topbar-h);padding-inline:var(--ui-space-2xl);background:var(--ui-color-surface);border-bottom:1px solid var(--ui-color-border)}
  .mark{display:flex;align-items:center;gap:var(--ui-space-sm);color:var(--ui-color-ink);text-decoration:none}
  .badge{display:grid;place-items:center;inline-size:30px;block-size:30px;border-radius:var(--ui-radius-sm);background:var(--ui-color-accent);color:var(--ui-color-on-accent);font-size:21px}
  .name{font-family:var(--ui-font-serif);font-size:17px;font-weight:var(--ui-weight-semibold);letter-spacing:.005em;white-space:nowrap}
  .finders{display:flex;align-items:stretch;gap:2px;min-inline-size:0;overflow-x:auto;scrollbar-width:none}
  .finders::-webkit-scrollbar{display:none}
  .finders a{position:relative;display:flex;align-items:center;padding:0 var(--ui-space-sm);color:var(--ui-color-ink-soft);text-decoration:none;font-size:var(--ui-text-sm);font-weight:var(--ui-weight-medium);white-space:nowrap}
  .finders a:hover{color:var(--ui-color-ink);background:var(--ui-color-surface-hover)}
  .finders a.on{color:var(--ui-color-ink);font-weight:var(--ui-weight-semibold)}
  .finders a.on::after{content:'';position:absolute;inset-inline:var(--ui-space-sm);bottom:0;block-size:2px;background:var(--ui-color-accent)}
  .finders .sources{margin-inline-start:var(--ui-space-sm);padding-inline-start:var(--ui-space-lg);border-inline-start:1px solid var(--ui-color-border)}
  .aside{margin-inline-start:auto;display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .reading :global(.ui-select){inline-size:154px}
  .lang :global(.ui-select){inline-size:104px}
  .font-pick{position:relative}
  .sample{font-size:18px;line-height:1}
  .font-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:var(--ui-z-menu);min-inline-size:200px}
  .font-menu .sample{font-size:19px;inline-size:22px;text-align:center}

  .body{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 400px;align-items:start}
  .body.full{grid-template-columns:minmax(0,1fr)}
  .finder{min-inline-size:0;padding:var(--ui-space-3xl) var(--ui-space-4xl) 72px}
  .card{position:sticky;top:var(--topbar-h);block-size:calc(100dvh - var(--topbar-h));overflow:auto;border-inline-start:1px solid var(--ui-color-border);background:var(--ui-color-surface);overscroll-behavior:contain}
  .fault{margin:64px auto;max-inline-size:36em;color:var(--ui-color-danger)}
  .tabs{display:none}

  .toast{position:fixed;left:50%;bottom:var(--ui-space-3xl);transform:translateX(-50%);z-index:var(--ui-z-toast);pointer-events:none}

  .sheet{margin:0;padding:var(--ui-space-lg) var(--ui-space-xl) calc(var(--ui-space-2xl) + env(safe-area-inset-bottom));inline-size:100%;max-inline-size:none;max-block-size:82dvh;border:0;border-top:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-2xl) var(--ui-radius-2xl) 0 0;background:var(--ui-color-surface);color:var(--ui-color-ink)}
  .sheet::backdrop{background:var(--ui-color-overlay)}
  .sheet-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--ui-space-sm)}
  .sheet-links{display:grid;gap:1px}
  .sheet-link{display:flex;align-items:baseline;gap:var(--ui-space-md);padding:var(--ui-space-md) var(--ui-space-sm);border-radius:var(--ui-radius-sm);color:var(--ui-color-ink);text-decoration:none}
  .sheet-link:hover,.sheet-link.on{background:var(--ui-color-surface-hover)}
  .sheet-link.on .sheet-name{color:var(--ui-color-accent-ink)}
  .sheet-name{font-size:var(--ui-text-md);font-weight:var(--ui-weight-semibold);white-space:nowrap}
  .sheet-lang{display:grid;gap:var(--ui-space-xs);margin-top:var(--ui-space-md)}

  @media (max-width:1180px){
    .top{gap:var(--ui-space-md);padding-inline:var(--ui-space-xl)}
    .finders a{padding-inline:var(--ui-space-xs);font-size:var(--ui-text-xs)}
    .finders a.on::after{inset-inline:var(--ui-space-xs)}
    .lang{display:none}
    .reading :global(.ui-select){inline-size:140px}
  }
  @media (max-width:900px){
    .top{gap:var(--ui-space-sm);padding-inline:var(--ui-space-lg)}
    .finders,.sources,.lang{display:none}
    .aside{gap:2px}
    .reading :global(.ui-select){inline-size:142px;font-size:var(--ui-text-2xs)}
    .body{grid-template-columns:minmax(0,1fr)}
    .finder{padding:var(--ui-space-xl) var(--ui-space-lg) 96px}
    .card{position:fixed;inset:0;block-size:100dvh;z-index:var(--ui-z-modal);border:0;transform:translateY(100%);transition:transform var(--ui-duration) var(--ui-ease);visibility:hidden}
    .card.open{transform:none;visibility:visible}
    .name{display:none}
    .tabs{position:fixed;inset-inline:0;bottom:0;z-index:var(--ui-z-chrome);display:flex;gap:2px;padding:var(--ui-space-xs) var(--ui-space-sm) calc(var(--ui-space-xs) + env(safe-area-inset-bottom));background:var(--ui-color-surface);border-top:1px solid var(--ui-color-border)}
    .tabs a,.tabs .more{flex:1 1 0;padding:9px 4px;border:0;border-radius:var(--ui-radius-sm);text-align:center;color:var(--ui-color-ink-soft);background:none;text-decoration:none;font-size:var(--ui-text-xs);font-weight:var(--ui-weight-medium);white-space:nowrap}
    .tabs a.extra{display:none}
    .tabs a.on,.tabs .more.on{background:var(--ui-color-accent-soft);color:var(--ui-color-accent-ink)}
    .toast{bottom:calc(76px + env(safe-area-inset-bottom))}
  }
  @media (prefers-reduced-motion:reduce){.card{transition:none}}
</style>
