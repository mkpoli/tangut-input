<script>
  // System, light or dark, as a segmented radio group.
  import Icon from './Icon.svelte'
  /** @type {{ theme: import('../lib/theme.js').Theme, labels: Record<string, string>, label: string, onchange: (theme: import('../lib/theme.js').Theme) => void }} */
  let { theme, labels, label, onchange } = $props()
  const uid = $props.id()
  const ICONS = /** @type {const} */ ({ system: 'system', light: 'sun', dark: 'moon' })
</script>

<div class="ui-segmented" role="radiogroup" aria-label={label}>
  {#each /** @type {const} */ (['system', 'light', 'dark']) as name (name)}
    <label class="ui-segment" title={labels[name]}>
      <input type="radio" name={uid + '-theme'} value={name} checked={theme === name}
        aria-label={labels[name]} onchange={() => onchange(name)} />
      <span class="ui-segment-face"><Icon name={ICONS[name]} size={16} /></span>
    </label>
  {/each}
</div>
