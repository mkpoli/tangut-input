<script>
  // The record of one component on hover: what Japanese scholarship calls its shape, its code point
  // and component number, how many characters use it, its Cangjie codes and what it is built from.
  import { ix, codePoint } from '../lib/db.svelte.js'
  import { directPartsIn } from '../lib/search.js'
  import { isDescriptionPart, leavesOf } from '../lib/composition.js'
  import PartGlyph from './PartGlyph.svelte'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {{ part: string, x: number, y: number, live?: number }} */
  let { part, x, y, live = -1 } = $props()
  const names = $derived(ix.names.filter(row => row.char === part))
  const credits = $derived([...new Set(names.map(row => row.credit))])
  const compared = $derived(ix.partNames?.rows.find(row => row.char === part) ?? null)
  const comparedLanguages = $derived.by(() => {
    const table = ix.partNames
    if (!table || !compared) return []
    return table.languages.filter(language => language !== 'ja' && compared.names[language]?.length)
  })
  const codes = $derived(ix.codes.get(part) ?? [])
  // A description part has no strokes of its own; its leaves' strokes are what it is written with.
  const strokes = $derived.by(() => {
    if (!isDescriptionPart(part)) return ix.strokes.get(part) ?? 0
    let total = 0
    for (const leaf of leavesOf(part)) {
      const count = ix.strokes.get(leaf) ?? 0
      if (!count) return 0
      total += count
    }
    return total
  })
  const uses = $derived(ix.usedBy.get(part)?.size ?? 0)
  const inner = $derived(directPartsIn(part))
  const single = $derived([...part].length === 1)
  const code = $derived(single ? part.codePointAt(0) ?? 0 : 0)
  const number = $derived(code >= 0x18800 && code <= 0x18AFF ? code - 0x18800 + 1 : 0)
  /** @param {number} count */
  const countText = count => count === 1 ? t('parts.info.oneCharacter') : t('common.characters', { count })
  const left = $derived(Math.max(8, Math.min(x, (globalThis.innerWidth ?? 1280) - 316)))
  const top = $derived(Math.max(8, Math.min(y, (globalThis.innerHeight ?? 800) - 300)))
</script>

<aside id="part-info" class="part-info ui-popover" style:left="{left}px" style:top="{top}px" role="tooltip">
  <header>
    <span class="glyph"><PartGlyph {part} /></span>
    <span class="head">
      {#if !single}<span class="ui-hint">{t('card.idsEditorial')}</span>{/if}
      <span class="ui-mono code">{single ? codePoint(part) : part}</span>
      {#if number}<span class="ui-hint">TANGUT COMPONENT-{String(number).padStart(3, '0')}</span>{/if}
    </span>
  </header>
  <dl>
    <dt>{t('parts.info.name')}</dt>
    <dd>
      {#if names.length}{names.map(row => row.name).join(' · ')}{:else}<span class="ui-hint">{t('parts.info.noName')}</span>{/if}
      {#if credits.length}<span class="credit">{credits.join(' · ')}</span>{/if}
    </dd>
    {#each comparedLanguages as language (language)}
      <dt>{t(`parts.names.${language}`)}</dt>
      <dd>{compared?.names[language]?.join(' · ')}</dd>
    {/each}
    <dt>{t('parts.info.strokes')}</dt>
    <dd>{strokes || '—'}</dd>
    <dt>{t('parts.info.uses')}</dt>
    <dd>{countText(uses)}</dd>
    {#if live >= 0}
      <dt>{t('parts.info.matches')}</dt>
      <dd>{countText(live)}</dd>
    {/if}
    {#if codes.length}
      <dt>{t('parts.info.codes')}</dt>
      <dd class="ui-mono">{codes.join(' ')}</dd>
    {/if}
    {#if inner.length}
      <dt>{t('parts.info.builtFrom')}</dt>
      <dd class="built">{#each inner as child, i (i)}<PartGlyph part={child} />{/each}</dd>
    {/if}
  </dl>
</aside>

<style>
  .part-info{position:fixed;z-index:var(--ui-z-hint);inline-size:300px;padding:var(--ui-space-md) var(--ui-space-lg);pointer-events:none;font-size:var(--ui-text-sm)}
  header{display:flex;align-items:center;gap:var(--ui-space-md)}
  .glyph{font-size:40px;line-height:1}
  .head{display:grid;gap:1px}
  .code{color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px var(--ui-space-md);margin:var(--ui-space-sm) 0 0;padding-top:var(--ui-space-sm);border-top:1px solid var(--ui-color-border)}
  dt{color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  dd{margin:0;font-size:var(--ui-text-xs);overflow-wrap:anywhere}
  .credit{display:block;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  .built{display:flex;flex-wrap:wrap;gap:2px;font-size:18px}
</style>
