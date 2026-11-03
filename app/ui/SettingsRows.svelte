<script>
  // The reader's display settings: the theme and palette in Appearance, the interface language and
  // the Tangut face in Text. The same rows serve the desktop popover and the phone's settings sheet.
  import { i18n, LOCALES, setLocale, t } from '../lib/i18n.svelte.js'
  import { TANGUT_FACES, setTangut, setTheme, ui } from '../lib/ui.svelte.js'
  import Icon from './Icon.svelte'
  import PaletteSelect from './PaletteSelect.svelte'

  const uid = $props.id()
  const face = $derived(TANGUT_FACES.find(entry => entry.key === ui.tangut) ?? TANGUT_FACES[0])

  /** @type {{ key: 'auto' | 'light' | 'dark', icon: 'auto' | 'sun' | 'moon', label: string }[]} */
  const THEMES = $derived([
    { key: 'auto', icon: 'auto', label: t('theme.auto') },
    { key: 'light', icon: 'sun', label: t('theme.light') },
    { key: 'dark', icon: 'moon', label: t('theme.dark') },
  ])
</script>

<div class="settings-rows">
  <section class="settings-group">
    <h3 class="ui-label settings-title">{t('settings.appearance')}</h3>

    <div class="settings-row">
      <span class="settings-name"><Icon name="auto" size={14} />{t('theme.label')}</span>
      <div class="ui-segmented" role="radiogroup" aria-label={t('theme.label')}>
        {#each THEMES as option (option.key)}
          <label class="ui-segment" title={option.label}>
            <input type="radio" name={`theme-${uid}`} value={option.key} checked={ui.theme === option.key}
              aria-label={option.label}
              onchange={() => setTheme(/** @type {'auto' | 'light' | 'dark'} */ (option.key))} />
            <span class="ui-segment-face"><Icon name={option.icon} size={16} /></span>
          </label>
        {/each}
      </div>
    </div>

    <div class="settings-row palette-row">
      <span class="settings-name"><Icon name="palette" size={14} />{t('palette.label')}</span>
      <PaletteSelect />
    </div>
  </section>

  <section class="settings-group">
    <h3 class="ui-label settings-title">{t('settings.text')}</h3>

    <label class="settings-row">
      <span class="settings-name"><Icon name="globe" size={14} />{t('lang.label')}</span>
      <span class="ui-select-wrap">
        <select class="ui-select" value={i18n.locale}
          onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setLocale(/** @type {any} */ (event.currentTarget.value))}>
          {#each LOCALES as locale (locale.key)}<option value={locale.key} lang={locale.key}>{locale.name}</option>{/each}
        </select>
      </span>
    </label>

    <label class="settings-row">
      <span class="settings-name"><Icon name="type" size={14} />{t('font.face')}</span>
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
  </section>
</div>

<style>
  .settings-rows{display:grid;gap:var(--ui-space-md);padding-block:var(--ui-space-2xs)}
  .settings-group{display:grid}
  .settings-title{margin:0;padding-block:var(--ui-space-xs) var(--ui-space-2xs)}
  .settings-row{display:grid;grid-template-columns:108px minmax(0,1fr);align-items:center;gap:var(--ui-space-sm);padding-block:var(--ui-space-md);border-bottom:1px solid var(--ui-color-border)}
  .settings-row:last-child{border-bottom:0}
  .palette-row{align-items:start}
  .palette-row .settings-name{padding-block-start:8px}
  .settings-name{display:flex;align-items:center;gap:var(--ui-space-xs);min-inline-size:0;color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm)}
  .settings-name :global(svg){color:var(--ui-color-ink-muted)}
  .settings-row > :global(.ui-select-wrap){inline-size:100%}
  .face-control{display:flex;align-items:center;gap:var(--ui-space-xs);min-inline-size:0}
  .face-control :global(.ui-select-wrap){flex:1;inline-size:auto}
  .face-sample{display:grid;place-items:center;inline-size:26px;block-size:26px;color:var(--ui-color-ink-soft);font-size:19px;line-height:1}
</style>
