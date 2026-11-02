<script>
  // Rhyme chart: the rhyme books' own arrangement, read as a chart. Down the side are the rhymes
  // with their tone, across the top the initial groups, and each cell holds the characters that
  // stand at that crossing — the place a dictionary of the 文海 would put them.
  import { db, ix, gloss } from '../lib/db.svelte.js'
  import { choose, put, ui, setReading } from '../lib/ui.svelte.js'
  import { t, i18n } from '../lib/i18n.svelte.js'
  import { SYSTEMS, systemName, systemTitle } from '../lib/reading.js'
  import { hanFanqie, sounds } from '../lib/fanqie.js'

  // The chart can be read two ways: by the rhyme books' own classes, or by the characters the
  // spellings are read from — the upper down one axis, the lower down the other — and each of those
  // either in Tangut or in the Chinese of Li Fanwen's sound gloss.
  // An object so the mode widens to a string: a literal state would be compared against values the
  // compiler does not think it can hold.
  const view = $state(/** @type {{ mode: string }} */ ({ mode: 'rhyme' }))
  let page = $state(0)
  const PER_PAGE = 20

  // The nine initial classes of the 同音, as the rhyme books name them: the Roman numeral is the
  // class, the Chinese word is the class's own name.
  const CLASSES = [
    { roman: 'Ⅰ', zh: '重唇音' }, { roman: 'Ⅱ', zh: '輕唇音' }, { roman: 'Ⅲ', zh: '舌頭音' },
    { roman: 'Ⅳ', zh: '舌上音' }, { roman: 'Ⅴ', zh: '牙音' }, { roman: 'Ⅵ', zh: '齒頭音' },
    { roman: 'Ⅶ', zh: '正齒音' }, { roman: 'Ⅷ', zh: '喉音' }, { roman: 'Ⅸ', zh: '來日音' },
  ]
  const GROUPS = CLASSES.map(entry => entry.roman)
  // The axes are read in the reader's reconstruction, 龔勛's unless they picked another.
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

  /**
   * The Chinese fanqie records, each naming the character it spells, its two characters and the
   * 直音 it is glossed with. @type {{ char: string, upper: string, lower: string, zhiyin: string }[]}
   */
  const hanRecords = $derived(ready ? hanFanqie(ix.entries) : [])

  /** The sounds the glosses record, each with the characters that sound so and every spelling
   *  written for it — 音勒 has twenty. The characters are not merged across sounds: one 直音 is one
   *  syllable, and a character that spells two sounds belongs to both. */
  const soundGroups = $derived.by(() => {
    if (String(view.mode) !== 'sound') return []
    const by = sounds(hanRecords)
    return [...by.entries()]
      .map(([sound, group]) => ({
        sound,
        characters: group.chars.sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0)),
        spellings: [...group.spellings].sort(),
      }))
      .sort((a, b) => b.characters.length - a.characters.length || (a.sound.codePointAt(0) ?? 0) - (b.sound.codePointAt(0) ?? 0))
  })

  /**
   * Two spellings that give one 直音 are one syllable, whatever their two characters, so the
   * characters that spell it are joined. Returns each symbol's group, labelled with its members.
   * @param {'upper' | 'lower'} side
   */


  /** A spelling grid: columns are the upper characters, rows the lower ones. */
  const spelling = $derived.by(() => {
    /** @type {Map<string, Map<string, { char: string, zhiyin: string }[]>>} */
    const grid = new Map()
    if (!ready) return grid
    if (String(view.mode) === 'han') {
      // The Chinese fanqie of Li Fanwen's sound gloss, e.g. 正齒音，奢餘切，音叔.
      for (const record of hanRecords) {
        // Characters known to spell one syllable share a column or a row; the list is curated,
        // because the glosses reuse a 直音 across syllables and cannot be trusted to derive it.
        const upper = (ix.fanqieAliases.get(record.upper) ?? [record.upper]).join('')
        const lower = (ix.fanqieAliases.get(record.lower) ?? [record.lower]).join('')
        const row = grid.get(lower) ?? new Map()
        grid.set(lower, row)
        const column = row.get(upper) ?? []
        column.push({ char: record.char, zhiyin: record.zhiyin })
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
        column.push({ char, zhiyin: '' })
        row.set(upper, column)
      }
    }
    for (const row of grid.values()) for (const column of row.values()) column.sort((a, b) => (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
    return grid
  })

  /** The upper characters, most used first, in pages of `PER_PAGE`. */
  const uppers = $derived.by(() => {
    const uses = new Map()
    for (const row of spelling.values()) for (const [upper, column] of row) uses.set(upper, (uses.get(upper) ?? 0) + column.length)
    // In the Chinese grid the columns keep their class together — 喉音 beside 喉音, 齒音 beside 齒音 —
    // so a reader can run down one sound at a time.
    const order = /** @type {Map<string, number>} */ (new Map(CLASSES.map((entry, index) => [entry.roman, index])))
    const classOf = (/** @type {string} */ upper) => order.get(upperClasses.get(upper)?.roman ?? '') ?? CLASSES.length
    return [...uses.entries()]
      .sort((a, b) => (String(view.mode) === 'han' ? classOf(a[0]) - classOf(b[0]) : 0)
        || b[1] - a[1] || (a[0].codePointAt(0) ?? 0) - (b[0].codePointAt(0) ?? 0))
      .map(([char]) => char)
  })
  /** For a Chinese upper character, the Tangut initial class it most often spells — its own label,
   *  read from the data rather than from a Chinese rhyme dictionary. */
  const upperClasses = $derived.by(() => {
    /** @type {Map<string, { roman: string, zh: string }>} */
    const found = new Map()
    if (String(view.mode) !== 'han') return found
    /** @type {Map<string, Map<string, number>>} */
    const counts = new Map()
    for (const row of spelling.values()) for (const [upper, column] of row) {
      const tally = counts.get(upper) ?? new Map()
      counts.set(upper, tally)
      for (const item of column) {
        const group = ix.rhymes.get(item.char)?.[2]
        if (group) tally.set(group, (tally.get(group) ?? 0) + 1)
      }
    }
    for (const [upper, tally] of counts) {
      const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
      const named = CLASSES.find(entry => entry.roman === best?.[0])
      if (named) found.set(upper, named)
    }
    return found
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

  /** The rhyme a Chinese lower character most often spells, the counterpart of the upper's class. */
  const lowerRhymes = $derived.by(() => {
    /** @type {Map<string, string>} */
    const found = new Map()
    if (String(view.mode) !== 'han') return found
    for (const [lower, row] of spelling) {
      /** @type {Map<string, number>} */
      const tally = new Map()
      for (const column of row.values()) for (const item of column) {
        const rhyme = ix.rhymes.get(item.char)?.[0]
        if (typeof rhyme === 'number') tally.set(String(rhyme), (tally.get(String(rhyme)) ?? 0) + 1)
      }
      const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
      if (best) found.set(lower, best[0])
    }
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
      <button type="button" class="chip" aria-pressed={String(view.mode) === 'sound'} onclick={() => { view.mode = 'sound'; page = 0 }}>{t('chart.mode.sound')}</button>
      {#if String(view.mode) === 'rhyme'}
        <button type="button" class="chip" aria-pressed={view2.adjacent} onclick={() => { view2.adjacent = !view2.adjacent }}>{t('chart.order')}</button>
      {/if}
      <label class="choose">
        <span class="label">{t('chart.system')}</span>
        <select class="field" value={ui.reading} onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setReading(event.currentTarget.value)} aria-label={t('chart.system')}>
          {#each SYSTEMS as entry (entry.key)}<option value={entry.key} title={systemTitle(entry)}>{systemName(entry, i18n.locale)}</option>{/each}
        </select>
      </label>
    </div>
  </header>

  {#if !ready}
    <p class="empty">{t('common.loading')}</p>
  {:else if String(view.mode) === 'sound'}
    <p class="muted legend">{t('chart.soundIntro', { sounds: soundGroups.length })}</p>
    <div class="sounds">
      {#each soundGroups as group (group.sound)}
        <section class="sound">
          <h3 class="sound-head">
            <span class="zh">{group.sound}</span>
            <small class="muted">{t('common.characters', { count: group.characters.length })}</small>
          </h3>
          <div class="tiles small">
            {#each group.characters as char (char)}
              {#if ix.rhymes.get(char)}
                <button class="tile" type="button" title={detail(char)} onclick={() => choose(char)} ondblclick={() => put(char)}>
                  <span class="tg">{char}</span>
                  <small class="muted">{(ix.rhymes.get(char)?.[3] ?? '') + (ix.rhymes.get(char)?.[4] ?? '')}</small>
                </button>
              {:else}
                <button class="tile" type="button" title={detail(char)} onclick={() => choose(char)} ondblclick={() => put(char)}><span class="tg">{char}</span></button>
              {/if}
            {/each}
          </div>
        </section>
      {/each}
    </div>
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
            {#each shownUppers as upper (upper)}
              <th scope="col" class="group tg" title={upperClasses.get(upper)?.zh ?? ''}>{upper}{#if upperClasses.get(upper)}<small lang="zh-Hant">{upperClasses.get(upper)?.zh}</small>{/if}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each spellRows as row (row.lower)}
            <tr>
              <th scope="row" class="rhyme tg">{row.lower}{#if lowerRhymes.get(row.lower)}<small>{t('card.rhyme')} {lowerRhymes.get(row.lower)}</small>{/if}</th>
              {#each row.cells as cell, i (i)}
                <td>
                  {#each cell as item (item.char)}<button type="button" class="tg cell" title={detail(item.char)} onclick={() => choose(item.char)} ondblclick={() => put(item.char)}>{item.char}{#if item.zhiyin}<small>{item.zhiyin}</small>{/if}</button>{/each}
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
              <th scope="col" class="group" title={`${group.roman} · ${group.zh}${onsets.get(group.roman)?.length ? ` · ${onsets.get(group.roman)?.join(' ')}` : ''}`}>
                <span class="roman">{group.roman}</span>
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
              <th scope="row" class="rhyme">
                <span>{row.rhyme}</span>
                {#if view2.adjacent}<span class="tone-label">{t(TONE_KEY[row.tone])}</span>{/if}
                {#if finals.get(row.key)?.length}<span class="final">{finals.get(row.key)?.join(' ')}</span>{/if}
                <small class="muted">{row.count}</small>
              </th>
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
  thead th.group .roman{display:block;font-size:12px}
  thead th.group .name{display:block;font-family:var(--ui);font-size:11.5px;color:var(--ink-2);letter-spacing:0;text-transform:none}
  thead th.group small{display:block;font-size:10px;color:var(--muted);font-weight:400}
  tbody th.rhyme{position:sticky;left:0;z-index:1;background:var(--raised);border-right:1px solid var(--line-strong);padding:4px 8px;text-align:right;font:600 13px var(--mono);white-space:nowrap;min-width:52px}
  tbody th.rhyme small{display:block;font-weight:400;font-size:10px}
  tbody th.rhyme .final{display:block;font-family:var(--serif);font-size:11.5px;font-weight:400;color:var(--ink-2);white-space:nowrap}
  tbody th.rhyme .tone-label{display:block;font-family:var(--ui);font-size:10.5px;font-weight:400;color:var(--muted);white-space:nowrap}
  tr.tone th{position:sticky;left:0;background:var(--sunk);color:var(--muted);text-align:left;padding:5px 10px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;border-top:1px solid var(--line-strong)}
  td{vertical-align:top;border-top:1px solid var(--line);border-left:1px solid var(--line);padding:3px;min-width:84px}
  .cell{font-family:var(--tangut);font-size:19px;line-height:1.12;border:0;background:none;padding:1px 2px;border-radius:5px;color:var(--ink)}
  .cell:hover{background:var(--accent-soft);color:var(--accent-ink)}
  .cell small{display:block;font-family:var(--ui);font-size:9.5px;color:var(--muted);line-height:1.1}
  .legend{font-size:12.5px;max-width:60em}
  .pager{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .sounds{display:grid;gap:14px;max-height:calc(100dvh - 300px);overflow:auto}
  .sound{display:grid;gap:6px;padding-bottom:10px;border-bottom:1px solid var(--line)}
  .sound-head{display:flex;align-items:baseline;gap:8px;margin:0}
  .sound-head .zh{font-size:20px;font-weight:600}
  .sound .tile small{font-family:var(--tangut);font-size:12px}
  .choose{display:flex;align-items:center;gap:6px;font-size:12.5px;margin-left:auto}
  .choose .label{white-space:nowrap}
  .choose select{padding:4px 8px;font-size:12.5px}
  .pager .muted{font-size:12.5px;margin-left:auto}
  .modes{display:flex;gap:5px}
  .chip[aria-pressed="true"]{border-color:var(--accent);color:var(--accent-ink);background:var(--accent-soft)}
  th.group.tg{font-family:var(--tangut);font-size:20px;color:var(--ink)}
  tbody th.rhyme.tg{font-family:var(--tangut);font-size:20px;color:var(--ink)}
  .empty{padding:18px 0;color:var(--muted);font-size:14px}
</style>
