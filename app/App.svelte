<script>
  // The frame: the bar with the finders, the text being written, the finder of the page, and the
  // card of the open character beside it (a sheet over it on a phone).
  import { tick } from 'svelte'
  import { db, load } from './lib/db.svelte.js'
  import { route, go, PAGES, GROUPS, PRIMARY } from './lib/route.svelte.js'
  import { ui, applyTangut, applyTheme, setReading } from './lib/ui.svelte.js'
  import { SYSTEMS, systemName, systemTitle } from './lib/reading.js'
  import { toast } from './lib/clip.svelte.js'
  import { i18n, t } from './lib/i18n.svelte.js'
  import { applySeo } from './lib/seo.js'
  import Writing from './ui/Writing.svelte'
  import SettingsRows from './ui/SettingsRows.svelte'
  import Card from './ui/Card.svelte'
  import Icon from './ui/Icon.svelte'
  import Find from './pages/Find.svelte'
  import Cangjie from './pages/Cangjie.svelte'
  import Sijiao from './pages/Sijiao.svelte'
  import Reading from './pages/Reading.svelte'
  import Draw from './pages/Draw.svelte'
  import Fanqie from './pages/Fanqie.svelte'
  import Chart from './pages/Chart.svelte'
  import Eras from './pages/Eras.svelte'
  import Transcribe from './pages/Transcribe.svelte'
  import Meaning from './pages/Meaning.svelte'
  import Parts from './pages/Parts.svelte'
  import About from './pages/About.svelte'
  import Intro from './pages/Intro.svelte'

  load()
  applyTheme()
  applyTangut()

  /** @type {HTMLElement | null} */
  let settingsTrigger = $state(null)
  /** @type {HTMLElement | null} */
  let settingsPop = $state(null)
  let settingsOpen = $state(false)
  let settingsSheetOpen = $state(false)
  /** @type {HTMLDialogElement | null} */
  let settingsDialog = $state(null)
  /** @type {null | { kind: 'more' } | { kind: 'group', label: string }} The phone's sheet. */
  let menu = $state(null)
  /** @type {HTMLDialogElement | null} */
  let sheet = $state(null)
  /** The tab that opened the sheet, so closing it puts the keyboard back there. @type {HTMLElement | null} */
  let menuTrigger = $state(null)
  /** Whether closing the sheet should return focus to its tab; a link that opens a page keeps the page's focus. */
  let returnFocus = true

  $effect(() => {
    void route.page
    applySeo(route.page)
  })

  // The phone sheet is a real dialog: the browser traps focus in it, closes it on Escape and
  // returns focus to the button that opened it.
  $effect(() => {
    if (!sheet) return
    if (menu && !sheet.open) sheet.showModal()
    if (!menu && sheet.open) sheet.close()
  })

  /** @param {MouseEvent} event @param {import('./lib/route.svelte.js').Page} page @returns {boolean} whether the page changes */
  function nav(event, page) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return false
    event.preventDefault()
    if (page === route.page) return false
    go(page)
    return true
  }

  /** @param {MouseEvent} event @param {{ kind: 'more' } | { kind: 'group', label: string }} next */
  function openMenu(event, next) {
    menuTrigger = /** @type {HTMLElement} */ (event.currentTarget)
    returnFocus = true
    menu = next
  }

  /** @param {boolean} [restore] whether to put the keyboard back on the tab */
  function closeMenu(restore = true) {
    returnFocus = restore
    menu = null
  }

  /** @param {string} label */
  const groupOpen = label => menu?.kind === 'group' && menu.label === label

  /** `/` focuses the page's input from anywhere outside a field. @param {KeyboardEvent} event */
  function keys(event) {
    const target = /** @type {HTMLElement} */ (event.target)
    const typing = target.closest('input, textarea, [contenteditable]')
    if (event.key === '/' && !typing) {
      const input = /** @type {HTMLElement | null} */ (document.querySelector('[data-primary]'))
      if (input) { event.preventDefault(); input.focus() }
    }
    if (event.key === 'Escape') {
      if (ui.sheet && !menu) ui.sheet = false
      if (settingsOpen) closeSettings()
    }
  }

  /** Open the settings: an anchored popover on a wide screen, a sheet on a phone. */
  async function openSettings() {
    if (matchMedia('(max-width: 900px)').matches) {
      settingsSheetOpen = true
      return
    }
    settingsOpen = true
    await tick()
    // The theme is the first control; its checked radio is the group's one tab stop.
    const panel = settingsPop
    const first = /** @type {HTMLElement | null} */ (
      panel?.querySelector('input[type="radio"]:checked') ?? panel?.querySelector('input, select')
    )
    first?.focus()
  }

  /** @param {boolean} [restore] */
  function closeSettings(restore = true) {
    settingsOpen = false
    settingsSheetOpen = false
    if (restore) settingsTrigger?.focus()
  }

  $effect(() => {
    if (!settingsOpen) return
    const outside = (/** @type {PointerEvent} */ event) => {
      if (!(/** @type {HTMLElement} */ (event.target)).closest('.settings')) settingsOpen = false
    }
    addEventListener('pointerdown', outside)
    return () => removeEventListener('pointerdown', outside)
  })

  $effect(() => {
    if (!settingsDialog) return
    if (settingsSheetOpen && !settingsDialog.open) settingsDialog.showModal()
    if (!settingsSheetOpen && settingsDialog.open) settingsDialog.close()
  })

  // Settings belongs to the layout it was opened in: a breakpoint change closes it.
  $effect(() => {
    const wide = matchMedia('(min-width: 901px)')
    const close = () => { if (settingsOpen || settingsSheetOpen) closeSettings(false) }
    wide.addEventListener('change', close)
    return () => wide.removeEventListener('change', close)
  })

  /** @param {FocusEvent} event */
  function settingsBlur(event) {
    const next = /** @type {Node | null} */ (event.relatedTarget)
    if (settingsOpen && next && !(/** @type {HTMLElement} */ (event.currentTarget)).contains(next)) settingsOpen = false
  }

  const readingSystem = $derived(SYSTEMS.find(system => system.key === ui.reading) ?? SYSTEMS[0])

  // Back or forward closes the sheet without pulling focus off the page that just opened.
  $effect(() => {
    const close = () => closeMenu(false)
    addEventListener('popstate', close)
    return () => removeEventListener('popstate', close)
  })

  // The sheet belongs to the phone's bar: a window that grows past it takes the sheet with it.
  $effect(() => {
    const wide = matchMedia('(min-width: 901px)')
    const close = () => { if (wide.matches) closeMenu(false) }
    wide.addEventListener('change', close)
    return () => wide.removeEventListener('change', close)
  })

  /** @param {null | { kind: 'more' } | { kind: 'group', label: string }} state */
  function groupOf(state) {
    if (!state || state.kind !== 'group') return undefined
    const { label } = state
    return GROUPS.find(group => group.label === label)
  }
  const menuGroup = $derived(groupOf(menu))
  const menuTitle = $derived(menuGroup ? t(menuGroup.label) : t('nav.more'))
</script>

<svelte:window onkeydown={keys} />

<div class="shell">
  <header class="top">
    <a class="mark" href="/" onclick={event => nav(event, '')} aria-label={t('app.home')}>
      <span class="badge ui-script" aria-hidden="true">𘅤</span>
      <span class="name">{t('app.name')}</span>
    </a>
    <nav class="finders" aria-label={t('nav.label')}>
      <a href="/" class="primary" class:on={route.page === ''} aria-current={route.page === '' ? 'page' : undefined}
        title={t(PRIMARY.hint)} onclick={event => nav(event, '')}><Icon name={PRIMARY.icon} size={14} stroke={1.6}/><span>{t(PRIMARY.label)}</span></a>
      {#each GROUPS as group (group.label)}
        <div class="group" role="group" aria-label={t(group.label)}>
          {#each group.pages as page (page.path)}
            <a href="/{page.path}" class:on={route.page === page.path} aria-current={route.page === page.path ? 'page' : undefined}
              title={t(page.hint)} onclick={event => nav(event, page.path)}><Icon name={page.icon} size={14} stroke={1.6}/><span>{t(page.label)}</span></a>
          {/each}
        </div>
      {/each}
    </nav>
    <div class="aside">
      <label class="reading" title={`${t('reading.system')}: ${systemTitle(readingSystem)}`}>
        <span class="reading-label" aria-hidden="true">{t('reading.system')}</span>
        <span class="reading-icon" aria-hidden="true"><Icon name="reconstruction" size={16}/></span>
        <span class="ui-visually-hidden">{t('reading.system')}</span>
        <span class="ui-select-wrap">
          <select class="ui-select" data-size="sm" value={ui.reading}
            onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setReading(event.currentTarget.value)}>
            {#each SYSTEMS as entry (entry.key)}<option value={entry.key} title={systemTitle(entry)}>{systemName(entry, i18n.locale)}</option>{/each}
          </select>
        </span>
      </label>
      <div class="settings" onfocusout={settingsBlur}>
        <button class="ui-button" data-variant="quiet" data-size="icon" type="button" bind:this={settingsTrigger}
          aria-label={t('settings.label')} title={t('settings.label')} aria-haspopup="dialog"
          aria-expanded={settingsOpen || settingsSheetOpen}
          onclick={() => { settingsOpen || settingsSheetOpen ? closeSettings() : openSettings() }}>
          <Icon name="settings" size={17}/>
        </button>
        {#if settingsOpen}
          <div class="settings-pop ui-popover" role="dialog" aria-label={t('settings.label')} bind:this={settingsPop}>
            <div class="settings-head">
              <h2 class="ui-label"><Icon name="settings" size={14}/>{t('settings.label')}</h2>
              <button class="ui-button" data-variant="quiet" data-size="icon-sm" type="button" aria-label={t('settings.close')} onclick={() => closeSettings()}><Icon name="close" size={16}/></button>
            </div>
            <SettingsRows />
          </div>
        {/if}
      </div>
    </div>
  </header>

  <Writing />

  {#if db.status === 'failed'}
    <p class="fault">{t('app.failed')}</p>
  {:else}
    <div class="body" class:full={route.page === 'about' || route.page === 'intro'}>
      <main class="finder" aria-label={t(PAGES.find(p => p.path === route.page)?.label ?? (route.page === 'intro' ? 'intro.title' : 'nav.sources'))}>
        {#if route.page === ''}<Find />
        {:else if route.page === 'meaning'}<Meaning />
        {:else if route.page === 'cangjie'}<Cangjie />
        {:else if route.page === 'sijiao'}<Sijiao />
        {:else if route.page === 'reading'}<Reading />
        {:else if route.page === 'fanqie'}<Fanqie />
        {:else if route.page === 'chart'}<Chart />
        {:else if route.page === 'eras'}<Eras />
        {:else if route.page === 'transcribe'}<Transcribe />
        {:else if route.page === 'draw'}<Draw />
        {:else if route.page === 'parts'}<Parts />
        {:else if route.page === 'intro'}<Intro />
        {:else}<About />{/if}
        {#if route.page !== 'about'}
          <footer class="foot ui-hint">
            †
            <a href="/about" title={t('nav.sources.hint')} onclick={event => nav(event, 'about')}>{t('nav.sources')}</a>
            {#if route.page !== 'intro'}· <a href="/intro" onclick={event => nav(event, 'intro')}>{t('nav.intro')}</a>{/if}
          </footer>
        {/if}
      </main>
      {#if route.page !== 'about' && route.page !== 'intro'}
        <aside class="card" class:open={ui.sheet} aria-label={t('card.label')}>
          <Card />
        </aside>
      {/if}
    </div>
  {/if}

  <nav class="tabs" aria-label={t('nav.label')}>
    <a class="tab" href="/" class:on={route.page === ''} aria-current={route.page === '' ? 'page' : undefined}
      onclick={event => nav(event, '')}><Icon name={PRIMARY.icon} size={18}/><span>{t(PRIMARY.tab)}</span></a>
    {#each GROUPS as group (group.label)}
      <button class="tab" type="button" class:on={group.pages.some(page => page.path === route.page)}
        aria-current={group.pages.some(page => page.path === route.page) ? 'true' : undefined}
        aria-haspopup="dialog" aria-expanded={groupOpen(group.label)}
        onclick={event => openMenu(event, { kind: 'group', label: group.label })}>
        <Icon name={group.icon} size={18}/>
        <span>{t(group.tab)}<svg class="caret" viewBox="0 0 10 10" width="8" height="8" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </button>
    {/each}
    <button class="tab" type="button" class:on={route.page === 'about' || route.page === 'intro'}
      aria-current={route.page === 'about' || route.page === 'intro' ? 'true' : undefined}
      aria-haspopup="dialog" aria-expanded={menu?.kind === 'more'}
      onclick={event => openMenu(event, { kind: 'more' })}><Icon name="more" size={18}/><span>{t('nav.more')}</span></button>
  </nav>

  <dialog class="sheet" bind:this={sheet} aria-label={menuTitle}
    onclose={() => { menu = null; if (returnFocus) menuTrigger?.focus(); returnFocus = true }}
    onclick={(/** @type {MouseEvent} */ event) => { if (event.target === sheet) closeMenu() }}>
    <div class="sheet-head">
      <p class="ui-label">{menuTitle}</p>
      <button class="ui-button" data-variant="quiet" data-size="icon-sm" type="button" aria-label={t('nav.menuClose')}
        onclick={() => closeMenu()}><Icon name="close" size={16}/></button>
    </div>
    {#if menuGroup}
      <div class="sheet-links">
        {#each menuGroup.pages as page (page.path)}
          <a class="sheet-link" href="/{page.path}" class:on={route.page === page.path} aria-current={route.page === page.path ? 'page' : undefined}
            onclick={event => closeMenu(!nav(event, page.path))}>
            <Icon name={page.icon} size={18}/>
            <span class="sheet-name">{t(page.label)}</span><span class="ui-hint">{t(page.hint)}</span>
          </a>
        {/each}
      </div>
    {:else}
      <div class="sheet-links">
        <a class="sheet-link" href="/intro" class:on={route.page === 'intro'} aria-current={route.page === 'intro' ? 'page' : undefined}
          onclick={event => closeMenu(!nav(event, 'intro'))}>
          <Icon name="book" size={18}/>
          <span class="sheet-name">{t('nav.intro')}</span><span class="ui-hint">{t('nav.intro.hint')}</span>
        </a>
        <a class="sheet-link" href="/about" class:on={route.page === 'about'} aria-current={route.page === 'about' ? 'page' : undefined}
          onclick={event => closeMenu(!nav(event, 'about'))}>
          <Icon name="sources" size={18}/>
          <span class="sheet-name">{t('nav.sources')}</span><span class="ui-hint">{t('nav.sources.hint')}</span>
        </a>
      </div>
    {/if}
  </dialog>

  <dialog class="sheet settings-sheet" bind:this={settingsDialog} aria-label={t('settings.label')}
    onclose={() => { settingsSheetOpen = false; settingsTrigger?.focus() }}
    onclick={(/** @type {MouseEvent} */ event) => { if (event.target === settingsDialog) closeSettings() }}>
    <div class="sheet-head">
      <h2 class="ui-label"><Icon name="settings" size={14}/>{t('settings.label')}</h2>
      <button class="ui-button" data-variant="quiet" data-size="icon-sm" type="button" aria-label={t('settings.close')}
        onclick={() => closeSettings()}><Icon name="close" size={16}/></button>
    </div>
    <SettingsRows />
  </dialog>

  <div class="toast" role="status" aria-live="polite">{#if toast.message}<span class="ui-toast">{toast.message}</span>{/if}</div>
</div>

<style>
  .shell{min-block-size:100dvh;display:flex;flex-direction:column}
  .top{position:sticky;top:0;z-index:var(--ui-z-chrome);display:flex;align-items:center;gap:var(--ui-space-xl);block-size:var(--topbar-h);padding-inline:var(--ui-space-2xl);background:var(--ui-color-surface);border-bottom:1px solid var(--ui-color-border)}
  .mark{display:flex;align-items:center;gap:var(--ui-space-sm);color:var(--ui-color-ink);text-decoration:none}
  .badge{display:grid;place-items:center;inline-size:30px;block-size:30px;border-radius:var(--ui-radius-sm);background:var(--ui-color-accent);color:var(--ui-color-on-accent);font-size:21px}
  .name{font-family:var(--ui-font-serif);font-size:17px;font-weight:var(--ui-weight-semibold);letter-spacing:.005em;white-space:nowrap}
  .finders{align-self:stretch;display:flex;align-items:stretch;gap:2px;min-inline-size:0;overflow-x:auto;scrollbar-width:none}
  .finders::-webkit-scrollbar{display:none}
  .finders a{position:relative;display:flex;align-items:center;gap:4px;padding:0 7px;color:var(--ui-color-ink-soft);text-decoration:none;font-size:var(--ui-text-sm);font-weight:var(--ui-weight-medium);white-space:nowrap}
  .finders a:hover{color:var(--ui-color-ink);background:var(--ui-color-surface-hover)}
  .finders a.on{color:var(--ui-color-ink);font-weight:var(--ui-weight-semibold)}
  .finders a.on::after{content:'';position:absolute;inset-inline:var(--ui-space-sm);bottom:0;block-size:2px;background:var(--ui-color-accent)}
  .finders .group{display:flex;align-items:stretch;gap:2px}
  .finders .primary{font-weight:var(--ui-weight-semibold)}
  .finders .group + .group, .finders .primary + .group{margin-inline-start:var(--ui-space-xs);padding-inline-start:var(--ui-space-xs);border-inline-start:1px solid var(--ui-color-border)}
  .aside{margin-inline-start:auto;display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .reading{display:flex;align-items:center;gap:var(--ui-space-xs)}
  .reading-label{color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);white-space:nowrap}
  .reading-icon{display:grid;place-items:center;color:var(--ui-color-ink-muted)}
  @media (max-width:1600px){.reading-label{display:none}}
  .reading :global(.ui-select){inline-size:154px}
  .settings{position:relative}
  .settings-pop{position:absolute;inset-inline-end:0;inset-block-start:calc(100% + var(--ui-space-sm));z-index:var(--ui-z-menu);inline-size:360px;padding:var(--ui-space-2xs) var(--ui-space-lg) var(--ui-space-sm)}
  .settings-head{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-sm);padding-block:var(--ui-space-2xs) var(--ui-space-xs);border-bottom:1px solid var(--ui-color-border)}
  .settings-head .ui-label,.sheet-head .ui-label{display:flex;align-items:center;gap:4px}
  .settings-head h2,.sheet-head h2{margin:0}

  .body{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 400px;align-items:start}
  .body.full{grid-template-columns:minmax(0,1fr)}
  .finder{min-inline-size:0;padding:var(--ui-space-3xl) var(--ui-space-4xl) 72px}
  .card{position:sticky;top:var(--topbar-h);block-size:calc(100dvh - var(--topbar-h));overflow:auto;border-inline-start:1px solid var(--ui-color-border);background:var(--ui-color-surface);overscroll-behavior:contain}
  .fault{margin:64px auto;max-inline-size:36em;color:var(--ui-color-danger)}
  .foot{margin-top:var(--ui-space-4xl);font-size:var(--ui-text-2xs);color:var(--ui-color-ink-soft)}
  .foot a{color:inherit;text-underline-offset:2px}
  .tabs{display:none}

  .toast{position:fixed;left:50%;bottom:var(--ui-space-3xl);transform:translateX(-50%);z-index:var(--ui-z-toast);pointer-events:none}

  .sheet{position:fixed;inset:auto 0 0 0;margin:0;overflow:auto;overscroll-behavior:contain;padding:var(--ui-space-lg) var(--ui-space-xl) calc(var(--ui-space-2xl) + env(safe-area-inset-bottom));inline-size:100%;max-inline-size:none;max-block-size:82dvh;border:0;border-top:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-2xl) var(--ui-radius-2xl) 0 0;background:var(--ui-color-surface);color:var(--ui-color-ink)}
  .sheet::backdrop{background:var(--ui-color-overlay)}
  .sheet-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--ui-space-sm);padding-inline:var(--ui-space-sm)}
  .sheet-links{display:grid;gap:1px}
  .sheet-link{display:flex;align-items:center;gap:var(--ui-space-md);padding:var(--ui-space-md) var(--ui-space-sm);border-radius:var(--ui-radius-sm);color:var(--ui-color-ink);text-decoration:none}
  .sheet-link:hover,.sheet-link.on{background:var(--ui-color-surface-hover)}
  .sheet-link.on .sheet-name{color:var(--ui-color-accent-ink)}
  .sheet-name{font-size:var(--ui-text-md);font-weight:var(--ui-weight-semibold);white-space:nowrap}

  @media (max-width:1300px){.reading-label{display:none}}
  @media (max-width:1180px){
    .top{gap:var(--ui-space-md);padding-inline:var(--ui-space-xl)}
    .finders a{padding-inline:var(--ui-space-xs);font-size:var(--ui-text-xs)}
    .finders a.on::after{inset-inline:var(--ui-space-xs)}
    .reading :global(.ui-select){inline-size:154px}
  }
  /* A tablet keeps every finder: the bar takes a second row, and its rule runs the width of the
     page like the row above. The sticky chrome below it follows the new height. */
  @media (min-width:901px) and (max-width:1439px){
    .shell{--topbar-h:96px}
    .top{flex-wrap:wrap;gap:0 var(--ui-space-xl);padding-inline:var(--ui-space-xl);block-size:var(--topbar-h)}
    .mark,.aside{block-size:55px}
    .finders{order:3;flex:0 0 100%;block-size:40px;border-top:1px solid var(--ui-color-border)}
    .finders a{padding-inline:var(--ui-space-sm);font-size:var(--ui-text-sm)}
    .finders a.on::after{inset-inline:var(--ui-space-sm)}
  }
  @media (max-width:900px){
    .shell{--topbar-h:54px}
    .top{gap:var(--ui-space-sm);padding-inline:var(--ui-space-lg)}
    .finders{display:none}
    .settings-pop{display:none}
    .aside{gap:2px}
    .reading :global(.ui-select){inline-size:142px;font-size:var(--ui-text-2xs)}
    .body{grid-template-columns:minmax(0,1fr)}
    .finder{padding:var(--ui-space-xl) var(--ui-space-lg) 96px}
    .card{position:fixed;inset:0;block-size:100dvh;z-index:var(--ui-z-modal);border:0;transform:translateY(100%);transition:transform var(--ui-duration) var(--ui-ease);visibility:hidden}
    .card.open{transform:none;visibility:visible}
    .name{display:none}
    .tabs{position:fixed;inset-inline:0;bottom:0;z-index:var(--ui-z-chrome);display:flex;gap:2px;padding:var(--ui-space-xs) var(--ui-space-sm) calc(var(--ui-space-xs) + env(safe-area-inset-bottom));background:var(--ui-color-surface);border-top:1px solid var(--ui-color-border)}
    .tabs .tab{flex:1 1 0;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:7px 3px;border:0;border-radius:var(--ui-radius-sm);color:var(--ui-color-ink-soft);background:none;text-decoration:none;font-family:inherit;font-size:var(--ui-text-xs);font-weight:var(--ui-weight-medium);white-space:nowrap;cursor:pointer}
    .tabs .tab span{display:inline-flex;align-items:center;gap:1px;line-height:1.15}
    .tabs .tab.on{background:var(--ui-color-accent-soft);color:var(--ui-color-accent-ink)}
    .caret{flex:none;opacity:.55}
    .toast{bottom:calc(76px + env(safe-area-inset-bottom))}
  }
  @media (prefers-reduced-motion:reduce){.card{transition:none}}
</style>
