<script>
  // Transcribe a line of Tangut: every character with the reading the reader's system gives it, the
  // line copied as those readings, and a table of all five systems for pasting elsewhere. The box
  // holds the same text as the writing strip, which flies into it on the way in.
  import { onMount } from 'svelte'
  import { db, ix, isTangut, gloss } from '../lib/db.svelte.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { text, attach, detach, setText } from '../lib/text.svelte.js'
  import { ui, setReading, choose } from '../lib/ui.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { SYSTEMS, systemName, systemTitle } from '../lib/reading.js'
  import { t, i18n } from '../lib/i18n.svelte.js'
  import G from '../ui/G.svelte'
  import MiniIme from '../ui/MiniIme.svelte'
  import SamplePicker from '../ui/SamplePicker.svelte'
  import Icon from '../ui/Icon.svelte'

  /** @type {HTMLTextAreaElement | null} */
  let box = $state(null)

  // A shared link carries the line in `?q=`; otherwise the writing strip's text is the line.
  if (route.q && route.q !== text.value) setText(route.q)
  else if (text.value) setQuery(text.value)

  // The strip is where the line was written, so it settles into the box rather than appearing.
  onMount(() => {
    const field = box
    if (!field) return
    attach(field)
    const from = document.getElementById('writing')
    if (from && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const a = from.getBoundingClientRect()
      const b = field.getBoundingClientRect()
      if (b.width && b.height) {
        field.animate([
          { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`, transformOrigin: 'top left' },
          { transform: 'none', transformOrigin: 'top left' },
        ], { duration: 280, easing: 'cubic-bezier(0.2, 0, 0, 1)' })
      }
    }
    return () => detach(field)
  })

  const query = $derived(text.value)
  // The records are a plain object filled after they load, so the reading has to hang off the
  // store's status to be recomputed once they arrive.
  const ready = $derived(db.status === 'ready')
  const chars = $derived(ready ? [...query].filter(char => isTangut(char)) : [])
  let all = $state(false)

  /** @param {string} char */
  const readingOf = char => (ix.byChar.get(char)?.pronunciations ?? {})[ui.reading]?.trim() ?? ''
  /** The line as readings, a dash where the data records none. */
  const transcription = $derived(chars.map(char => readingOf(char) || '—').join(' '))
  /** All five systems, one row per character, tab-separated. */
  const table = $derived.by(() => {
    const rows = [['char', ...SYSTEMS.map(system => system.key), 'rhyme', 'meaning'].join('\t')]
    for (const char of chars) {
      const readings = ix.byChar.get(char)?.pronunciations ?? {}
      const rhyme = ix.rhymes.get(char)
      rows.push([char, ...SYSTEMS.map(system => readings[system.key] ?? ''), rhyme?.[0] ?? '', gloss(char)].join('\t'))
    }
    return rows.join('\n')
  })

  /** @param {Event & { currentTarget: HTMLTextAreaElement }} event */
  function type(event) {
    setText(event.currentTarget.value)
    setQuery(event.currentTarget.value)
  }
</script>

<div class="ui-page transcribe" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="transcribe" size={22}/><span>{t('nav.transcribe')}</span></h1>
    <p class="ui-page-intro">{t('transcribe.intro')}</p>
  </header>

  <textarea bind:this={box} class="ui-textarea transcribe-input ui-script" rows="2" value={query} spellcheck="false" autocomplete="off"
    aria-label={t('transcribe.input')} placeholder={t('transcribe.placeholder')} oninput={type}></textarea>

  <div class="ui-toolbar">
    <MiniIme align="start" />
    <SamplePicker align="start" syncQuery onpick={() => box?.focus()} />
    <label class="choose">
      <span class="ui-label">{t('reading.system')}</span>
      <span class="ui-select-wrap">
        <select class="ui-select" data-size="sm" value={ui.reading} onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setReading(event.currentTarget.value)}>
          {#each SYSTEMS as entry (entry.key)}<option value={entry.key} title={systemTitle(entry)}>{systemName(entry, i18n.locale)}</option>{/each}
        </select>
      </span>
    </label>
    <button type="button" class="ui-chip" aria-pressed={all} onclick={() => { all = !all }}>{t('transcribe.allSystems')}</button>
    <button type="button" class="ui-button" data-size="sm" disabled={!chars.length} onclick={() => copy(transcription)}><Icon name="copy" size={14}/>{t('transcribe.copyLine')}</button>
    <button type="button" class="ui-button" data-size="sm" disabled={!chars.length} onclick={() => copy(table)}><Icon name="copy" size={14}/>{t('transcribe.copyTable')}</button>
    <span class="ui-count toolbar-end">{t('transcribe.count', { count: chars.length })}</span>
  </div>

  {#if chars.length}
    <output class="transcription ui-serif" aria-live="polite">{transcription}</output>

    <div class="ui-table-wrap">
    <table class="ui-table">
      <thead>
        <tr>
          <th scope="col">{t('transcribe.char')}</th>
          {#if all}
            {#each SYSTEMS as system (system.key)}<th scope="col">{systemName(system, i18n.locale)}</th>{/each}
          {:else}
            <th scope="col">{systemName(SYSTEMS.find(system => system.key === ui.reading) ?? SYSTEMS[0], i18n.locale)}</th>
          {/if}
          <th scope="col">{t('card.rhyme')}</th>
          <th scope="col">{t('transcribe.meaning')}</th>
        </tr>
      </thead>
      <tbody>
        {#each chars as char, i (i)}
          <tr>
            <th scope="row"><button type="button" class="glyph" onclick={() => choose(char)} title={char}><G char={char} /></button></th>
            {#if all}
              {#each SYSTEMS as system (system.key)}<td class="say">{(ix.byChar.get(char)?.pronunciations ?? {})[system.key] ?? ''}</td>{/each}
            {:else}
              <td class="say">{readingOf(char) || '—'}</td>
            {/if}
            <td class="rhyme-cell">{ix.rhymes.get(char)?.[0] ?? '—'}{#if ix.rhymes.get(char)?.[1]} · {t(`card.tone.${ix.rhymes.get(char)?.[1] === 1 ? 'level' : ix.rhymes.get(char)?.[1] === 2 ? 'rising' : 'entering'}`)}{/if}</td>
            <td class="gloss">{gloss(char)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
  {:else}
    <p class="ui-empty">{t('transcribe.empty')}</p>
  {/if}
</div>

<style>
  .transcribe{min-inline-size:0}
  .transcribe-input{min-block-size:64px;padding-block:var(--ui-space-sm);font-size:22px;line-height:1.45}
  .choose{display:flex;align-items:center;gap:var(--ui-space-xs)}
  .choose :global(.ui-select){inline-size:196px}
  .transcription{display:block;padding:var(--ui-space-md) var(--ui-space-xl);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface);font-size:var(--ui-text-lg);line-height:1.6;overflow-wrap:anywhere;user-select:text}
  .glyph{display:inline-grid;place-items:center;min-inline-size:32px;min-block-size:32px;padding:2px;border:0;border-radius:var(--ui-radius-xs);background:none;color:inherit;line-height:1}
  .glyph:hover{background:var(--ui-color-surface-hover)}
  .glyph :global(.ui-script){font-size:26px}
  .say{font-family:var(--ui-font-serif);font-size:var(--ui-text-md);white-space:nowrap}
  .gloss{max-inline-size:22em}
  .rhyme-cell{color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);white-space:nowrap}
  @media (max-width:700px){
    .choose{inline-size:100%}
    .choose :global(.ui-select){flex:1;inline-size:auto}
    .toolbar-end{margin-inline-start:0}
  }
</style>
