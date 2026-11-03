<script>
  // The input method on its own: the site's own box, always open, for a tool that embeds this page
  // as its picker. A pick is posted to the window that embedded it.
  import MiniIme from './ui/MiniIme.svelte'
  import { db, load } from './lib/db.svelte.js'
  import { t } from './lib/i18n.svelte.js'
  import { setLocale } from './lib/i18n.svelte.js'

  // The picker loads its own records: on the site the app does it, here there is no app.
  load()

  // The language follows the reader's, as on the site.
  if (typeof navigator !== 'undefined') {
    const wanted = navigator.language.startsWith('zh') ? 'zh-Hant' : navigator.language.startsWith('ja') ? 'ja' : navigator.language.startsWith('ko') ? 'ko' : 'en'
    setLocale(/** @type {any} */ (wanted))
  }
</script>

<main class="pick">
  <p class="ui-hint">{#if db.status === 'ready'}{t('pick.hint')}{:else}{t('common.loading')}{/if}</p>
  <MiniIme always />
</main>

<style>
  .pick{display:grid;gap:8px;padding:10px;align-content:start;background:var(--ui-color-surface)}
  /* The box takes the keys as soon as the page is up: an embedded picker should not need a click. */
  .pick :global(.ime input){outline:none}
</style>
