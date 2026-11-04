<script>
  // Rhyme chart: the rhyme books' own arrangement, read as a chart. Down the side are the rhymes
  // with their tone, across the top the initial groups, and each cell holds the characters that
  // stand at that crossing — the place a dictionary of the 文海 would put them.
  import { db, ix, gloss } from '../lib/db.svelte.js'
  import { choose, put, ui, setReading } from '../lib/ui.svelte.js'
  import { t, i18n } from '../lib/i18n.svelte.js'
  import { SYSTEMS, systemName, systemTitle } from '../lib/reading.js'
  import Icon from '../ui/Icon.svelte'
  import { tibetanShown, tibetanTitle } from '../lib/tibetan.js'

  // The chart can be read two ways: by the rhyme books' own classes, or by the characters the
  // spellings are read from — the upper down one axis, the lower down the other.
  // An object so the mode widens to a string: a literal state would be compared against values the
  // compiler does not think it can hold.
  const view = $state(/** @type {{ mode: string }} */ ({ mode: 'rhyme' }))
  let page = $state(0)
  const PER_PAGE = 20

  // The nine initial classes of the 同音: the Roman numeral is the class, `zh` its name in the rhyme
  // books' Chinese, `tangut` the 同音's own chapter title (唇音重一品 and so on: the class's place and
  // 音, then its number and 品), as tabulated in 孫伯君 2017.
  const CLASSES = [
    { roman: 'Ⅰ', zh: '重唇音', tangut: '𗠉𗙏𗊢𘈩𘄿' }, { roman: 'Ⅱ', zh: '輕唇音', tangut: '𗠉𗙏𗥫𗍫𘄿' },
    { roman: 'Ⅲ', zh: '舌頭音', tangut: '𗢯𘁙𗙏𘕕𘄿' }, { roman: 'Ⅳ', zh: '舌上音', tangut: '𗢯𗀔𗙏𗥃𘄿' },
    { roman: 'Ⅴ', zh: '牙音', tangut: '𘟗𗙏𗏁𘄿' }, { roman: 'Ⅵ', zh: '齒頭音', tangut: '𘘄𘁙𗙏𗤁𘄿' },
    { roman: 'Ⅶ', zh: '正齒音', tangut: '𘘄𗹑𗙏𗒹𘄿' }, { roman: 'Ⅷ', zh: '喉音', tangut: '𗍂𗙏𘉋𘄿' },
    { roman: 'Ⅸ', zh: '來日音', tangut: '𘚶𘞨𗙏𗢭𘄿' },
  ]
  const GROUPS = CLASSES.map(entry => entry.roman)
  // The axes are read in the reader's reconstruction.
  /** @param {string} reading */
  const toneOff = reading => reading.replace(/[¹²³⁴⁵⁰?\d]+$/g, '')
  /** The initial a reading begins with: everything before its first vowel. @param {string} reading */
  const initialOf = reading => /^[^aeiouəɨɐɛɔɑ]+/i.exec(toneOff(reading))?.[0] ?? ''
  /** The initials the readings in each class begin with, most common first: the class's sound. */
  const onsets = $derived.by(() => {
    /** @type {Map<string, string[]>} */
    const found = new Map()
    if (!ready) return found
    /** @type {Map<string, Map<string, number>>} */
    const counts = new Map()
    for (const entry of ix.entries) {
      const roman = ix.rhymes.get(entry.char)?.[2]
      const reading = entry.pronunciations?.[ui.reading]?.trim() ?? ''
      if (!roman || !reading) continue
      const head = initialOf(reading)
      if (!head) continue
      const row = counts.get(roman) ?? new Map()
      counts.set(roman, row)
      row.set(head, (row.get(head) ?? 0) + 1)
    }
    for (const [roman, row] of counts) {
      found.set(roman, [...row.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([head]) => head))
    }
    return found
  })
  const TONES = [1, 2, 4, 0]
  /** @type {Record<number, string>} */
  const TONE_KEY = { 1: 'card.tone.level', 2: 'card.tone.rising', 4: 'card.tone.entering', 0: 'chart.tone.unknown' }

  const ready = $derived(db.status === 'ready')

  /** Every character, by rhyme and tone, then by initial group. */
  const table = $derived.by(() => {
    /** @type {Map<string, Map<string, string[]>>} */
    const byRhyme = new Map()
    if (!ready) return byRhyme
    for (const [char, value] of ix.rhymes) {
      const [rhyme, tone, group] = value
      // A handful of rows in the source give the rhyme as a question mark; they have no place here.
      if (typeof rhyme !== 'number') continue
      const key = `${rhyme}·${tone ?? 0}`
      const row = byRhyme.get(key) ?? new Map()
      byRhyme.set(key, row)
      const column = row.get(group ?? '') ?? []
      column.push(char)
      row.set(group ?? '', column)
    }
    for (const row of byRhyme.values()) for (const column of row.values()) column.sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
    return byRhyme
  })

  /** Whether the two tones of a rhyme sit together, or the rhymes come in the tone sections the
   *  rhyme books keep. NGWU YOH's reading of the chart is the first, and the default. */
  const view2 = $state({ adjacent: true })
  const rows = $derived.by(() => {
    const list = [...table.entries()].map(([key, columns]) => {
      const [rhyme, tone] = key.split('·').map(Number)
      const count = [...columns.values()].reduce((sum, column) => sum + column.length, 0)
      return { key, rhyme, tone, columns, count }
    })
    return list.sort(view2.adjacent
      ? (a, b) => a.rhyme - b.rhyme || TONES.indexOf(a.tone) - TONES.indexOf(b.tone)
      : (a, b) => TONES.indexOf(a.tone) - TONES.indexOf(b.tone) || a.rhyme - b.rhyme)
  })

  /** A spelling grid: columns are the upper characters, rows the lower ones. */
  const spelling = $derived.by(() => {
    /** @type {Map<string, Map<string, { char: string }[]>>} */
    const grid = new Map()
    if (!ready) return grid
    for (const [char, value] of ix.rhymes) {
      const upper = value[3] || value[5]
      const lower = value[4] || value[6]
      if (!upper || !lower || upper === '?' || lower === '?') continue
      const row = grid.get(lower) ?? new Map()
      grid.set(lower, row)
      const column = row.get(upper) ?? []
      column.push({ char })
      row.set(upper, column)
    }
    for (const row of grid.values()) for (const column of row.values()) column.sort((a, b) => (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
    return grid
  })

  /** The upper characters, most used first, in pages of `PER_PAGE`. */
  const uppers = $derived.by(() => {
    const uses = new Map()
    for (const row of spelling.values()) for (const [upper, column] of row) uses.set(upper, (uses.get(upper) ?? 0) + column.length)
    return [...uses.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0].codePointAt(0) ?? 0) - (b[0].codePointAt(0) ?? 0))
      .map(([char]) => char)
  })
  /** The final each rhyme is read with in the chosen system, most common first. */
  const finals = $derived.by(() => {
    /** @type {Map<string, string[]>} */
    const found = new Map()
    if (!ready) return found
    /** @type {Map<string, Map<string, number>>} */
    const counts = new Map()
    for (const [char, value] of ix.rhymes) {
      const [rhyme, tone] = value
      if (typeof rhyme !== 'number') continue
      const reading = ix.byChar.get(char)?.pronunciations?.[ui.reading]?.trim() ?? ''
      const initial = initialOf(reading)
      if (!reading || !initial) continue
      const final = toneOff(reading).slice(initial.length)
      if (!final) continue
      const key = `${rhyme}·${tone ?? 0}`
      const row = counts.get(key) ?? new Map()
      counts.set(key, row)
      row.set(final, (row.get(final) ?? 0) + 1)
    }
    for (const [key, row] of counts) found.set(key, [...row.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([final]) => final))
    return found
  })

  const pages = $derived(Math.max(1, Math.ceil(uppers.length / PER_PAGE)))
  const shownUppers = $derived(uppers.slice(page * PER_PAGE, (page + 1) * PER_PAGE))
  /** The lowers that have a character under one of the uppers on this page. */
  const spellRows = $derived.by(() => {
    const list = []
    for (const [lower, row] of spelling) {
      const cells = shownUppers.map(upper => row.get(upper) ?? [])
      if (cells.some(cell => cell.length)) list.push({ lower, cells })
    }
    return list.sort((a, b) => (a.lower.codePointAt(0) ?? 0) - (b.lower.codePointAt(0) ?? 0))
  })

  /** What a cell says about one character when opened: its fanqie, Tibetan gloss and meaning. @param {string} char */
  function detail(char) {
    const value = ix.rhymes.get(char)
    const spelling = value ? [value[3] ?? value[5], value[4] ?? value[6]].filter(Boolean).join('') : ''
    const tibetan = (ix.tibetan.get(char) ?? []).map(([wylie, script, where]) => `${script} ${wylie} (${where.map(([shelf]) => shelf).join(', ')})`).join('; ')
    return [char, spelling ? `反切 ${spelling}` : '', tibetan ? `藏 ${tibetan}` : '', gloss(char)].filter(Boolean).join(' · ')
  }
</script>

<div class="ui-page chart" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="chart" size={22}/><span>{t('nav.chart')}</span></h1>
    <p class="ui-page-intro">{t('chart.intro')}</p>
    <div class="ui-toolbar modes" role="group" aria-label={t('chart.axis')}>
      <button type="button" class="ui-chip" aria-pressed={String(view.mode) === 'rhyme'} onclick={() => { view.mode = 'rhyme'; page = 0 }}>{t('chart.mode.rhyme')}</button>
      <button type="button" class="ui-chip" aria-pressed={String(view.mode) === 'tangut'} onclick={() => { view.mode = 'tangut'; page = 0 }}>{t('chart.mode.tangut')}</button>
      {#if String(view.mode) === 'rhyme'}
        <button type="button" class="ui-chip" aria-pressed={view2.adjacent} onclick={() => { view2.adjacent = !view2.adjacent }}>{t('chart.order')}</button>
      {/if}
      <label class="choose">
        <span class="ui-label">{t('chart.system')}</span>
        <span class="ui-select-wrap">
          <select class="ui-select" data-size="sm" value={ui.reading} onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setReading(event.currentTarget.value)} aria-label={t('chart.system')}>
            {#each SYSTEMS as entry (entry.key)}<option value={entry.key} title={systemTitle(entry)}>{systemName(entry, i18n.locale)}</option>{/each}
          </select>
        </span>
      </label>
    </div>
  </header>

  {#if !ready}
    <p class="ui-empty">{t('common.loading')}</p>
  {:else if String(view.mode) !== 'rhyme'}
    <div class="ui-toolbar">
      <span class="ui-count">{t('chart.page', { page: page + 1, pages })}</span>
      <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={page === 0} onclick={() => { page = Math.max(0, page - 1) }} aria-label={t('chart.prev')}><Icon name="prev" size={16}/></button>
      <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={page >= pages - 1} onclick={() => { page = Math.min(pages - 1, page + 1) }} aria-label={t('chart.next')}><Icon name="next" size={16}/></button>
    </div>
    <div class="wrap">
      <table>
        <thead>
          <tr>
            <th class="corner" scope="col"><span>{t('chart.lower')}</span> / {t('chart.upper')}</th>
            {#each shownUppers as upper (upper)}
              <th scope="col" class="group"><span class="ui-script">{upper}</span></th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each spellRows as row (row.lower)}
            <tr>
              <th scope="row" class="head-cell"><span class="ui-script">{row.lower}</span></th>
              {#each row.cells as cell, i (i)}
                <td>
                  {#each cell as item (item.char)}<button type="button" class="cell ui-script" title={detail(item.char)} onclick={() => choose(item.char)} ondblclick={() => put(item.char)}>{item.char}</button>{/each}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="wrap">
      <table>
        <thead>
          <tr>
            <th class="corner" scope="col"><span>{t('chart.rhyme')}</span> / {t('chart.group')}</th>
            {#each CLASSES as group (group.roman)}
              <th scope="col" class="group" title={`${group.roman} · ${group.tangut} · ${group.zh}${onsets.get(group.roman)?.length ? ` · ${onsets.get(group.roman)?.join(' ')}` : ''}`}>
                <span class="roman">{group.roman}</span>
                <span class="tangut ui-script" lang="txg">{group.tangut}</span>
                <span class="name" lang="zh-Hant">{group.zh}</span>
                {#if onsets.get(group.roman)?.length}<small>{onsets.get(group.roman)?.join(' ')}</small>{/if}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as row, index (row.key)}
            {#if !view2.adjacent && row.tone !== rows[index - 1]?.tone}
              <tr class="tone"><th colspan={GROUPS.length + 1}>{t(TONE_KEY[row.tone])}</th></tr>
            {/if}
            <tr>
              <th scope="row" class="head-cell rhyme">
                <span class="rhyme-number">{row.rhyme}</span>
                {#if view2.adjacent}<span class="tone-label">{t(TONE_KEY[row.tone])}</span>{/if}
                {#if finals.get(row.key)?.length}<span class="final">{finals.get(row.key)?.join(' ')}</span>{/if}
                <small class="ui-count">{row.count}</small>
              </th>
              {#each GROUPS as group (group)}
                <td>
                  {#if row.columns.get(group)?.length}
                    {#each row.columns.get(group) ?? [] as char (char)}
                      <button type="button" class="cell ui-script" title={detail(char)} onclick={() => choose(char)} ondblclick={() => put(char)}>{char}{#if ix.tibetan.has(char)}<small class="tibetan">{#each ix.tibetan.get(char) ?? [] as [wylie, script, where], index (index)}{index ? ' ' : ''}<span lang="bo" title={tibetanTitle(wylie, where)}>{tibetanShown(wylie, script)}</span>{/each}</small>{/if}</button>
                    {/each}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="ui-hint">{t('chart.legend')}</p>
  {/if}
</div>

<style>
  .modes{gap:var(--ui-space-xs)}
  .choose{display:flex;align-items:center;gap:var(--ui-space-xs);margin-inline-start:auto}
  .choose .ui-label{white-space:nowrap}
  .wrap{overflow:auto;max-block-size:calc(100dvh - 250px);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  table{inline-size:100%;border-collapse:separate;border-spacing:0;font-size:var(--ui-text-sm)}
  thead th{position:sticky;top:0;z-index:2;padding:var(--ui-space-sm) var(--ui-space-xs);border-bottom:1px solid var(--ui-color-border-strong);background:var(--ui-color-surface);color:var(--ui-color-ink-muted);font-family:var(--ui-font-mono);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-semibold)}
  /* The first column keeps its text width — a percentage column sits out the surplus — so the columns
     to its right take the rest of the card, or overflow it when the grid is wider. */
  thead th.corner{left:0;z-index:3;inline-size:1%;text-align:start;white-space:nowrap;font-family:var(--ui-font-sans);font-weight:var(--ui-weight-medium)}
  thead th.group{text-align:center;inline-size:84px}
  thead th.group .ui-script{display:block;font-size:19px;color:var(--ui-color-ink)}
  thead th.group .tangut{display:block;font-size:13px;white-space:nowrap;color:var(--ui-color-ink)}
  thead th.group .roman{display:block;font-size:var(--ui-text-xs)}
  thead th.group .name{display:block;font-family:var(--ui-font-sans);font-size:var(--ui-text-2xs);color:var(--ui-color-ink-soft);font-weight:var(--ui-weight-normal);letter-spacing:0;text-transform:none}
  thead th.group small{display:block;font-size:10px;color:var(--ui-color-ink-muted);font-weight:var(--ui-weight-normal)}
  tbody th.head-cell{position:sticky;left:0;z-index:1;padding:var(--ui-space-2xs) var(--ui-space-sm);border-inline-end:1px solid var(--ui-color-border);background:var(--ui-color-surface);text-align:end;white-space:nowrap;min-inline-size:52px;font-family:var(--ui-font-mono);font-size:var(--ui-text-xs)}
  tbody th.head-cell .ui-script{display:block;font-size:20px;color:var(--ui-color-ink)}
  tbody th.head-cell small{display:block;font-weight:var(--ui-weight-normal);font-size:10px;color:var(--ui-color-ink-muted)}
  tbody th.head-cell .rhyme-number{font-size:var(--ui-text-sm);font-weight:var(--ui-weight-semibold);color:var(--ui-color-ink)}
  tbody th.head-cell .final{display:block;font-family:var(--ui-font-serif);font-size:var(--ui-text-2xs);color:var(--ui-color-ink-soft)}
  tbody th.head-cell .tone-label{display:block;font-family:var(--ui-font-sans);font-size:10px;color:var(--ui-color-ink-muted)}
  tr.tone th{position:sticky;left:0;background:var(--ui-color-surface-sunken);color:var(--ui-color-ink-muted);text-align:start;padding:var(--ui-space-2xs) var(--ui-space-sm);font-size:var(--ui-text-2xs);letter-spacing:var(--ui-tracking-caps);text-transform:uppercase;border-top:1px solid var(--ui-color-border-strong)}
  td{vertical-align:top;border-top:1px solid var(--ui-color-border);border-inline-start:1px solid var(--ui-color-border);padding:3px;min-inline-size:84px}
  .cell{vertical-align:top;padding:1px 3px;border:1px solid transparent;border-radius:var(--ui-radius-xs);background:none;color:var(--ui-color-ink);font-size:19px;line-height:1.12}
  .cell:hover{border-color:var(--ui-color-border-strong);background:var(--ui-color-surface-hover)}
  .cell small.tibetan{font-family:'Noto Serif Tibetan','Noto Sans Tibetan',Kailasa,'Microsoft Himalaya','Jomolhari',serif;font-size:11px;line-height:1.3;color:var(--ui-color-ink-soft)}
  .cell small{display:block;font-family:var(--ui-font-sans);font-size:9.5px;color:var(--ui-color-ink-muted);line-height:1.1}
  @media (max-width:900px){
    .choose{margin-inline-start:0}
    .wrap{max-block-size:calc(100dvh - 300px)}
    td{min-inline-size:70px}
  }
</style>
