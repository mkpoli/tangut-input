<script>
  // The reader's display settings: the colour scheme, the light or dark side, the interface
  // language and the face the script is set in. The same rows serve the desktop popover and the
  // phone's settings sheet.
  import { i18n, LOCALES, setLocale, t } from '../lib/i18n.svelte.js'
  import { PALETTES, TANGUT_FACES, setPalette, setTangut, setTheme, ui } from '../lib/ui.svelte.js'
  import Icon from './Icon.svelte'

  const face = $derived(TANGUT_FACES.find(entry => entry.key === ui.tangut) ?? TANGUT_FACES[0])
</script>

<div class="settings-rows">
  <label class="settings-row">
    <span class="ui-label"><Icon name="sun" size={14}/>{t('theme.label')}</span>
    <span class="ui-select-wrap">
      <select class="ui-select" value={ui.theme}
        onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setTheme(/** @type {'auto' | 'light' | 'dark'} */ (event.currentTarget.value))}>
        <option value="auto">{t('theme.auto')}</option>
        <option value="light">{t('theme.light')}</option>
        <option value="dark">{t('theme.dark')}</option>
      </select>
    </span>
  </label>

  <label class="settings-row">
    <span class="ui-label"><Icon name="palette" size={14}/>{t('palette.label')}</span>
    <span class="ui-select-wrap">
      <select class="ui-select" value={ui.palette}
        onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setPalette(/** @type {'paper' | 'mineral' | 'indigo' | 'sand'} */ (event.currentTarget.value))}>
        {#each PALETTES as entry (entry.key)}<option value={entry.key}>{t(entry.label)}</option>{/each}
      </select>
    </span>
  </label>

  <label class="settings-row">
    <span class="ui-label"><Icon name="globe" size={14}/>{t('lang.label')}</span>
    <span class="ui-select-wrap">
      <select class="ui-select" value={i18n.locale}
        onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setLocale(/** @type {any} */ (event.currentTarget.value))}>
        {#each LOCALES as locale (locale.key)}<option value={locale.key} lang={locale.key}>{locale.name}</option>{/each}
      </select>
    </span>
  </label>

  <label class="settings-row">
    <span class="ui-label">{t('font.face')}</span>
    <span class="face-control">
      <span class="ui-script face-sample" style:font-family={face.family} aria-hidden="true">𗀀</span>
      <span class="ui-select-wrap">
        <select class="ui-select" value={ui.tangut}
          onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setTangut(/** @type {'serif' | 'yinchuan' | 'wenhai' | 'kai'} */ (event.currentTarget.value))}>
          {#each TANGUT_FACES as entry (entry.key)}<option value={entry.key}>{t(entry.label)}</option>{/each}
        </select>
      </span>
    </span>
  </label>
</div>

<style>
  .settings-rows{display:grid}
  .settings-row{display:grid;grid-template-columns:92px minmax(0,1fr);align-items:center;gap:var(--ui-space-md);padding-block:var(--ui-space-md);border-bottom:1px solid var(--ui-color-border)}
  .settings-row:last-child{border-bottom:0}
  .settings-row > .ui-label{display:flex;align-items:center;gap:4px}
  .settings-row > :global(.ui-select-wrap){inline-size:100%}
  .face-control{display:flex;align-items:center;gap:var(--ui-space-xs);min-inline-size:0}
  .face-control :global(.ui-select-wrap){flex:1;inline-size:auto}
  .face-sample{display:grid;place-items:center;inline-size:26px;block-size:26px;color:var(--ui-color-ink-soft);font-size:19px;line-height:1}
</style>
