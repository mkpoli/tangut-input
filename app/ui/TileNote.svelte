<script>
  import { db, ix } from '../lib/db.svelte.js'
  import { hanGloss } from '../lib/gloss.js'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {{ char: string, text?: string }} */
  let { char, text = '' } = $props()
  const han = $derived(hanGloss(db.status === 'ready' ? ix.leilin.get(char) : undefined))
</script>

{#if han.text || text}
  <span class="ui-tile-note tile-note">
    {#if han.text}<span class="ui-tile-han" lang="zh-Hant" title={`${t('card.leilinTitle')}: ${han.title}`}>{han.text}</span>{/if}
    {#if text && text !== han.text}<span class="ui-tile-note-text" title={text}>{text}</span>{/if}
  </span>
{/if}

<style>
  .tile-note{display:grid;inline-size:100%;min-block-size:calc(2.6em + 1px);align-content:end;gap:1px;text-align:center}
  .tile-note > span{min-inline-size:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ui-tile-han{color:var(--ui-color-ink-soft)}
</style>
