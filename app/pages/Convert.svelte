<script>
  // A text set in the Tangut Yinchuan PUA codes, turned back into the characters those codes name.
  // The table below the editors holds every recorded code, including the ones with no character.
  import { db, ix, codePoint } from '../lib/db.svelte.js'
  import { convertTangutPua, tangutPuaTable, puaCharacter, PUA_SOURCE, PUA_FONT } from '../lib/pua.js'
  import { choose, autofocus } from '../lib/ui.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import Icon from '../ui/Icon.svelte'

  const params = new URLSearchParams(location.search)
  let input = $state(params.get('q') ?? '')
  let filter = $state('')
  const ready = $derived(db.status === 'ready')
  const version = $derived(ready ? ix.puaSource?.version ?? '' : '')
  const table = $derived(ready && ix.puaSource ? tangutPuaTable(ix.puaSource) : [])
  const ZERO = { converted: 0, remaining: 0, unencoded: 0, otherPua: 0, ambiguous: 0, unicode18: 0 }
  const result = $derived(ready ? convertTangutPua(input, ix.puaIndex, ix.puaEncodedIndex, ix.puaUnencodedIndex) : { text: input, ...ZERO })
  const needle = $derived(filter.trim().toLowerCase())
  const matches = $derived(!needle ? table : table.filter(row =>
    row.code.toLowerCase().includes(needle) || row.char.includes(needle) ||
    (row.char && codePoint(row.char).toLowerCase().includes(needle)) ||
    row.ids.toLowerCase().includes(needle) || row.sources.join(' ').toLowerCase().includes(needle)))
  const rows = $derived(matches.slice(0, 100))

  /** @param {Event & { currentTarget: HTMLTextAreaElement }} event */
  function typed(event) {
    input = event.currentTarget.value
  }

  function clear() {
    input = ''
  }
</script>

<div class="ui-page convert" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="convert" size={22}/><span>{t('nav.convert')}</span></h1>
    <p class="ui-page-intro">{t('convert.intro')}</p>
  </header>

  <div class="editors">
    <div class="ui-field">
      <div class="field-head">
        <label class="ui-label" for="convert-input">{t('convert.input')}</label>
        <button class="ui-button" data-size="sm" type="button" disabled={!input} onclick={clear}>{t('convert.clear')}</button>
      </div>
      <textarea id="convert-input" class="ui-textarea editor" data-primary rows="7" value={input} oninput={typed}
        placeholder={t('convert.placeholder')} aria-label={t('convert.input')} spellcheck="false" autocomplete="off" use:autofocus></textarea>
    </div>
    <div class="ui-field">
      <div class="field-head">
        <label class="ui-label" for="convert-output">{t('convert.output')}</label>
        <button class="ui-button" data-size="sm" type="button" disabled={!result.text}
          onclick={() => copy(result.text, t('convert.output'))}>{t('common.copy')}</button>
      </div>
      <textarea id="convert-output" class="ui-textarea editor output" rows="7" readonly value={result.text}
        aria-label={t('convert.output')} spellcheck="false"></textarea>
    </div>
  </div>

  <div class="ui-toolbar counts" role="status" aria-live="polite" aria-atomic="true">
    <span>{t('convert.converted', { count: result.converted })}</span>
    <span>{t('convert.remaining', { count: result.remaining })}</span>
    {#if result.unencoded}<span>{t('convert.unencoded', { count: result.unencoded })}</span>{/if}
    {#if result.otherPua}<span>{t('convert.otherPua', { count: result.otherPua })}</span>{/if}
    {#if result.ambiguous}<span>{t('convert.ambiguous', { count: result.ambiguous })}</span>{/if}
  </div>

  <p class="ui-hint note">{t('convert.note')}</p>

  <details class="mapping">
    <summary class="ui-label">{t('convert.mapping')} <span class="ui-count">{table.length}</span></summary>
    <div class="tools">
      <input class="ui-input" type="search" bind:value={filter} placeholder={t('convert.filter')} aria-label={t('convert.filter')} spellcheck="false" autocomplete="off">
    </div>
    <div class="ui-table-wrap">
      <table class="ui-table" aria-label={t('convert.mapping')}>
        <thead><tr>
          <th scope="col">{t('convert.pua')}</th>
          <th scope="col">{t('convert.unicode')}</th>
          <th scope="col">{t('convert.ids')}</th>
          <th scope="col">{t('convert.source')}</th>
        </tr></thead>
        <tbody>
          {#each rows as row (`${row.code}-${row.ids}`)}
            <tr>
              <td class="pua-cell"><span class="pua-glyph" aria-hidden="true">{puaCharacter(row.code)}</span><span class="ui-mono">{row.code}</span></td>
              <td class="unicode-cell">
                {#if row.char}
                  <button type="button" class="char ui-script" title={codePoint(row.char)} aria-label={`${row.char} (${codePoint(row.char)})`} onclick={() => choose(row.char)}>{row.char}</button>
                  <span class="point ui-mono">{codePoint(row.char)}</span>
                  {#if row.status === 'new'}<span class="ui-tag">{t('convert.status.new')}</span>{/if}
                {:else}
                  <span class="ui-hint">—</span>
                  <span class="ui-tag">{t('convert.status.unencoded')}</span>
                {/if}
              </td>
              <td class="ids-cell"><span class="ui-formula" title={row.ids}>{row.ids}</span></td>
              <td class="source-cell">{row.sources.length ? row.sources.join(' · ') : t('variants.puaNoSource')}</td>
            </tr>
          {/each}
          {#if !rows.length}
            <tr><td class="empty" colspan="4">{t('convert.noMatches')}</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
    {#if matches.length > rows.length}<p class="ui-hint">{t('common.of', { shown: rows.length, total: matches.length })}</p>{/if}
  </details>

  <footer class="ui-hint attribution">
    {#if version}<a href={PUA_SOURCE} target="_blank" rel="noopener noreferrer">{t('card.puaSource', { version })}</a> · {/if}
    <a href={PUA_FONT} target="_blank" rel="noopener noreferrer">{t('convert.font')}</a>
  </footer>
</div>

<style>
  .editors{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:var(--ui-space-lg)}
  .field-head{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-sm);flex-wrap:wrap}
  .editor{min-block-size:180px;max-block-size:360px;font-family:'Tangut PUA',var(--tg-font);font-size:var(--ui-text-lg);line-height:1.55;resize:vertical}
  .output{background:var(--ui-color-surface-sunken)}
  .counts{color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm);font-variant-numeric:tabular-nums}
  .note{margin:0}
  .mapping summary{cursor:pointer;padding-block:var(--ui-space-xs)}
  .mapping .ui-table-wrap{margin-block-start:0;max-block-size:min(70vh,640px)}
  .tools{display:flex;align-items:center;gap:var(--ui-space-sm);margin-block:var(--ui-space-sm)}
  .tools input{flex:1}
  .pua-cell,.unicode-cell{white-space:nowrap}
  .pua-glyph{display:inline-block;margin-inline-end:var(--ui-space-sm);font-family:'Tangut PUA',var(--tg-font);font-size:24px;line-height:1;vertical-align:-3px}
  .char{padding:0 2px;border:0;border-radius:var(--ui-radius-xs);background:none;color:inherit;font:inherit;font-size:1.5em;line-height:1.1;cursor:pointer}
  .char:hover{background:var(--ui-color-accent-soft)}
  .point{margin-inline-start:var(--ui-space-xs);font-size:var(--ui-text-2xs);color:var(--ui-color-ink-soft)}
  .unicode-cell .ui-tag{margin-inline-start:var(--ui-space-xs)}
  .ids-cell{min-inline-size:180px}
  .source-cell{min-inline-size:140px;max-inline-size:280px;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .empty{padding-block:var(--ui-space-lg);color:var(--ui-color-ink-soft);text-align:center}
  .attribution{padding-block-start:var(--ui-space-lg);border-block-start:1px solid var(--ui-color-border);overflow-wrap:anywhere}
</style>
