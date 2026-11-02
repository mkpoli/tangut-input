<script>
  // Rhyme chart: the rhyme books' own arrangement, read as a chart. Down the side are the rhymes
  // with their tone, across the top the initial groups, and each cell holds the characters that
  // stand at that crossing — the place a dictionary of the 文海 would put them.
  import { db, ix, gloss } from '../lib/db.svelte.js'
  import { choose, put } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  // The chart can be read two ways: by the rhyme books' own classes, or by the characters the
  // spellings are read from — the upper down one axis, the lower down the other — and each of those
  // either in Tangut or in the Chinese of Li Fanwen's sound gloss.
  // An object so the mode widens to a string: a literal state would be compared against values the
  // compiler does not think it can hold.
  const view = $state(/** @type {{ mode: string }} */ ({ mode: 'rhyme' }))
  let page = $state(0)
  const PER_PAGE = 20
  const HAN = /([\u4e00-\u9fff])([\u4e00-\u9fff])切/

  const GROUPS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ']
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

  /** The rows, in the order the rhyme books keep them: by tone, then by rhyme number. */
  const rows = $derived.by(() => {
    const list = [...table.entries()].map(([key, columns]) => {
      const [rhyme, tone] = key.split('·').map(Number)
      const count = [...columns.values()].reduce((sum, column) => sum + column.length, 0)
      return { key, rhyme, tone, columns, count }
    })
    return list.sort((a, b) => TONES.indexOf(a.tone) - TONES.indexOf(b.tone) || a.rhyme - b.rhyme)
  })

  /** A spelling grid: columns are the upper characters, rows the lower ones. */
  const spelling = $derived.by(() => {
    /** @type {Map<string, Map<string, string[]>>} */
    const grid = new Map()
    if (!ready) return grid
    if (String(view.mode) === 'han') {
      // The Chinese fanqie of Li Fanwen's sound gloss, e.g. 正齒音，奢餘切，音叔.
      for (const entry of ix.entries) {
        const text = entry.pronunciations?.sound_li_fanwen ?? ''
        const found = HAN.exec(text)
        if (!found) continue
        const [, upper, lower] = found
        const row = grid.get(lower) ?? new Map()
        grid.set(lower, row)
        const column = row.get(upper) ?? []
        column.push(entry.char)
        row.set(upper, column)
      }
    } else {
      for (const [char, value] of ix.rhymes) {
        const upper = value[3] || value[5]
        const lower = value[4] || value[6]
        if (!upper || !lower || upper === '?' || lower === '?') continue
        const row = grid.get(lower) ?? new Map()
        grid.set(lower, row)
        const column = row.get(upper) ?? []
        column.push(char)
        row.set(upper, column)
      }
    }
    for (const row of grid.values()) for (const column of row.values()) column.sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
    return grid
  })

  /** The upper characters, most used first, in pages of `PER_PAGE`. */
  const uppers = $derived.by(() => {
    const uses = new Map()
    for (const row of spelling.values()) for (const [upper, column] of row) uses.set(upper, (uses.get(upper) ?? 0) + column.length)
    return [...uses.entries()].sort((a, b) => b[1] - a[1] || (a[0].codePointAt(0) ?? 0) - (b[0].codePointAt(0) ?? 0)).map(([char]) => char)
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

  /** What a cell says about one character when opened: its fanqie, class and gloss. @param {string} char */
  function detail(char) {
    const value = ix.rhymes.get(char)
    const spelling = value ? [value[3] ?? value[5], value[4] ?? value[6]].filter(Boolean).join('') : ''
    const sound = ix.byChar.get(char)?.pronunciations?.sound_li_fanwen?.trim() ?? ''
    return [char, spelling ? `反切 ${spelling}` : '', sound, gloss(char)].filter(Boolean).join(' · ')
  }
</script>

<div class="chart">
  <header class="intro">
    <h1>{t('nav.chart')}</h1>
    <p class="muted">{t('chart.intro')}</p>
    <div class="modes" role="group" aria-label={t('chart.axis')}>
      <button type="button" class="chip" aria-pressed={String(view.mode) === 'rhyme'} onclick={() => { view.mode = 'rhyme'; page = 0 }}>{t('chart.mode.rhyme')}</button>
      <button type="button" class="chip" aria-pressed={String(view.mode) === 'tangut'} onclick={() => { view.mode = 'tangut'; page = 0 }}>{t('chart.mode.tangut')}</button>
      <button type="button" class="chip" aria-pressed={String(view.mode) === 'han'} onclick={() => { view.mode = 'han'; page = 0 }}>{t('chart.mode.han')}</button>
    </div>
  </header>

  {#if !ready}
    <p class="empty">{t('common.loading')}</p>
  {:else if String(view.mode) !== 'rhyme'}
    <div class="pager">
      <span class="muted">{t('chart.page', { page: page + 1, pages })}</span>
      <button type="button" class="chip" disabled={page === 0} onclick={() => { page = Math.max(0, page - 1) }} aria-label={t('chart.prev')}>‹</button>
      <button type="button" class="chip" disabled={page >= pages - 1} onclick={() => { page = Math.min(pages - 1, page + 1) }} aria-label={t('chart.next')}>›</button>
    </div>
    <div class="wrap">
      <table>
        <thead>
          <tr>
            <th class="corner" scope="col"><span>{t('chart.lower')}</span> / {t('chart.upper')}</th>
            {#each shownUppers as upper (upper)}<th scope="col" class="group tg">{upper}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each spellRows as row (row.lower)}
            <tr>
              <th scope="row" class="rhyme tg">{row.lower}</th>
              {#each row.cells as cell, i (i)}
                <td>
                  {#each cell as char (char)}<button type="button" class="tg cell" title={detail(char)} onclick={() => choose(char)} ondblclick={() => put(char)}>{char}</button>{/each}
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
            {#each GROUPS as group (group)}<th scope="col" class="group">{group}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.key)}
            {#if row.tone !== rows[rows.indexOf(row) - 1]?.tone}
              <tr class="tone"><th colspan={GROUPS.length + 1}>{t(TONE_KEY[row.tone])}</th></tr>
            {/if}
            <tr>
              <th scope="row" class="rhyme"><span>{row.rhyme}</span><small class="muted">{row.count}</small></th>
              {#each GROUPS as group (group)}
                <td>
                  {#if row.columns.get(group)?.length}
                    {#each row.columns.get(group) ?? [] as char (char)}
                      <button type="button" class="tg cell" title={detail(char)} onclick={() => choose(char)} ondblclick={() => put(char)}>{char}</button>
                    {/each}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="legend muted">{t('chart.legend')}</p>
  {/if}
</div>

<style>
  .chart{display:grid;gap:14px;max-width:1100px}
  .intro{display:grid;gap:6px}
  h1{font-family:var(--serif);font-size:26px;font-weight:600}
  .intro p{font-size:13.5px;max-width:56em}
  .wrap{overflow:auto;max-height:calc(100dvh - 260px);border:1px solid var(--line);border-radius:12px;background:var(--surface)}
  table{border-collapse:separate;border-spacing:0;font-size:13px}
  thead th{position:sticky;top:0;z-index:2;background:var(--raised);border-bottom:1px solid var(--line-strong);padding:7px 6px;font:600 12px var(--mono);color:var(--muted)}
  thead th.corner{left:0;z-index:3;text-align:left;white-space:nowrap;font-family:var(--ui);font-weight:500}
  thead th.group{text-align:center;width:84px}
  tbody th.rhyme{position:sticky;left:0;z-index:1;background:var(--raised);border-right:1px solid var(--line-strong);padding:4px 8px;text-align:right;font:600 13px var(--mono);white-space:nowrap;min-width:52px}
  tbody th.rhyme small{display:block;font-weight:400;font-size:10px}
  tr.tone th{position:sticky;left:0;background:var(--sunk);color:var(--muted);text-align:left;padding:5px 10px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;border-top:1px solid var(--line-strong)}
  td{vertical-align:top;border-top:1px solid var(--line);border-left:1px solid var(--line);padding:3px;min-width:84px}
  .cell{font-family:var(--tangut);font-size:19px;line-height:1.12;border:0;background:none;padding:1px 2px;border-radius:5px;color:var(--ink)}
  .cell:hover{background:var(--accent-soft);color:var(--accent-ink)}
  .legend{font-size:12.5px;max-width:60em}
  .pager{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .pager .muted{font-size:12.5px;margin-left:auto}
  .modes{display:flex;gap:5px}
  .chip[aria-pressed="true"]{border-color:var(--accent);color:var(--accent-ink);background:var(--accent-soft)}
  th.group.tg{font-family:var(--tangut);font-size:20px;color:var(--ink)}
  tbody th.rhyme.tg{font-family:var(--tangut);font-size:20px;color:var(--ink)}
  .empty{padding:18px 0;color:var(--muted);font-size:14px}
</style>
