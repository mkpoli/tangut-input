<script>
  // Everything recorded about the open character, arranged around using it: the actions come
  // first, then what helps a reader confirm it is the one they mean (meaning, readings, structure,
  // where it stands in a text), then the characters near it.
  import { db, ix, codePoint, gloss, isComponent, readingOf } from '../lib/db.svelte.js'
  import { onMount, tick } from 'svelte'
  import G from './G.svelte'
  import TileNote from './TileNote.svelte'
  import Icon from './Icon.svelte'
  import { route, link } from '../lib/route.svelte.js'
  import { ui, put, choose } from '../lib/ui.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { puaCharacter } from '../lib/pua.js'
  import { SYSTEMS, systemName, systemTitle } from '../lib/reading.js'
  import { derivedDescriptions } from '../lib/variants.js'
  import { byDescription } from '../lib/search.js'
  import { idsViews } from '../lib/ids-views.js'
  import { openingOf } from '../lib/description.js'
  import { partsOfSpeech } from '../lib/pos.js'
  import Ids from './Ids.svelte'
  import Attest from './Attest.svelte'
  import { loadWenhaiComposition } from '../lib/data.js'
  import Peek from './Peek.svelte'
  import Spelling from './Spelling.svelte'
  import { i18n, t } from '../lib/i18n.svelte.js'
  import { ccamcUrl } from '../lib/ccamc.js'
  import { tibetanShown, tibetanWhere } from '../lib/tibetan.js'
  import { hasCardReadings } from '../lib/card-readings.js'
  import { bookTitle } from '../lib/books.js'
  import { setaCode } from '../lib/seta.js'
  import { identifierGroups, editionName } from '../lib/identifiers.js'

  const char = $derived(route.c)
  const ready = $derived(db.status === 'ready')
  /** @type {{ entries: Record<string, { position: string, parts: [string, string | null][] }> }} */
  let compositions = $state({ entries: {} })
  onMount(async () => { compositions = await loadWenhaiComposition() })
  const construction = $derived(char ? compositions.entries[char] : undefined)
  const PART_TERMS = { whole: '全', left: '左', middle: '中', right: '右', top: '上', bottom: '下', surrounding: '圍' }
  /** @param {string | null} part */
  const partTerm = part => part ? (PART_TERMS[/** @type {keyof typeof PART_TERMS} */ (part)] ?? part) : ''
  const entry = $derived(ready && char ? ix.byChar.get(char) : undefined)
  // A private-use glyph has no character record; its PUA row is the whole card. A code with a
  // base character still gets this card, with the base as a link.
  const puaVariant = $derived(ready && char
    ? /** @type {{ code: string, ids: string, sources: string[], char?: string } | null} */ (
      ix.puaUnencodedIndex.get(`U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}`)
      ?? ix.puaByCode.get(`U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}`)
      ?? null)
    : null)
  // Opening a variant replaces the tile that had focus; move focus to the card it opens.
  let focusPua = $state(false)
  /** @type {HTMLElement | null} */
  let puaArticle = $state(null)
  $effect(() => {
    if (!focusPua || !puaVariant) return
    tick().then(() => { puaArticle?.focus(); focusPua = false })
  })
  const codes = $derived(ready && char ? ix.codes.get(char) ?? [] : [])
  const identifiers = $derived(ready && char ? identifierGroups(ix.identifiers.get(char) ?? []) : [])
  const pua = $derived(ready && char ? ix.pua.get(char) ?? [] : [])
  const strokes = $derived(ready && char ? entry?.total_strokes ?? ix.strokes.get(char) : undefined)
  const meanings = $derived(entry?.definitions ?? {})
  const downes = $derived(ready && char ? ix.downes.get(char) : undefined)
  const leilin = $derived(ready && char ? ix.leilin.get(char) : undefined)
  const variants = $derived(ready && char ? ix.variants.get(char) : undefined)
  // The same substitution the possible pairs use, written out where no character carries it.
  const derivedForms = $derived(ready && entry?.composition ? derivedDescriptions(entry, ix.byDescription) : [])
  // The group the character stands in, when a pair list would hide part of it: a chain of stated
  // forms, or the pair someone reported.
  const family = $derived(ready && char ? ix.familyOf.get(char) : undefined)
  const linkedGroup = $derived(family && (family.links.length > 1 || family.grounds.some(ground => ground.kind === 'reported')) ? family : undefined)
  // The part of speech the Chinese gloss marks, where it marks one.
  const wordClass = $derived(partsOfSpeech([...(meanings.zh ?? []), ...(entry?.wiktionary_zh ?? [])]))
  const READING_FIELDS = /** @type {readonly { key: string, name?: string, zh?: string, label?: string, lang: string }[]} */ ([
    { key: 'sound_li_fanwen', name: 'Li Fanwen', zh: '李範文', lang: 'zh-Hant' },
    { key: 'sound_nie_lishan', name: 'Nie Lishan', zh: '聶歷山', lang: 'zh-Hant' },
    { key: 'tibetan', label: 'card.tibetan', lang: 'bo' },
  ])
  /** A transcribed field's label: a sound gloss names the scholar in the reader's script, a
   * transcription its own script. @param {{ name?: string, zh?: string, label?: string }} field */
  const fieldLabel = field => {
    if (!field.name) return t(/** @type {string} */ (field.label))
    const name = /^(ja|zh|ko)/.test(i18n.locale) && field.zh ? field.zh : field.name
    return t('card.soundGloss', { name })
  }

  const readings = $derived(SYSTEMS.map(system => ({ ...system, value: entry?.pronunciations?.[system.key]?.trim() ?? '' })).filter(r => r.value))
  // The rhyme books: the class a character stands in, its tone, and the two characters its spelling
  // is read from. 文海 where it has one, 合編 where it does not.
  const rhyme = $derived(ready && char ? ix.rhymes.get(char) : undefined)
  const rhymeClass = $derived(rhyme?.[0] ? String(rhyme[0]) : '')
  // Tibetan and Sanskrit spellings from a study known only through a repost: see the sources page.
  const hands = $derived(ready && char ? ix.tibetanHands[char] : undefined)
  const tibetanGlosses = $derived(ready && char ? ix.tibetan.get(char) ?? [] : [])
  const toneName = $derived(
    rhyme?.[1] === 1 ? 'card.tone.level'
      : rhyme?.[1] === 2 ? 'card.tone.rising'
        : rhyme?.[1] === 4 ? 'card.tone.entering'
          : '',
  )
  const spelling = $derived.by(() => {
    if (!rhyme) return ''
    /** @param {string | null | undefined} value */
    const cell = value => (value && value !== '?' ? value : '')
    const upper = [cell(rhyme[3]), cell(rhyme[4])].filter(Boolean)
    if (upper.length) return upper.join('')
    return [cell(rhyme[5]), cell(rhyme[6])].filter(Boolean).join('')
  })

  const same = $derived.by(() => {
    if (!entry?.composition) return []
    return ix.entries.filter(other => other.char !== char && other.composition === entry.composition).map(other => other.char)
  })
  /**
   * The books and pages a keyed value stands on. @param {string} field
   * @returns {{ work: string, locator: string, note: string }[]}
   */
  const cites = field => ix.citations[char]?.[field] ?? []

  /**
   * A locator as the reader sees it: a 掌中珠 column is canvas, band and column, the rest is the
   * page as written. @param {string} locator
   */
  const place = locator => locator
    .replace(/^canvas (\d+) band (\d+) c(\d+)$/, (_, canvas, band, column) => `${canvas}·${band}·${column}`)
    .replace(/^canvas (\d+) c(\d+)$/, (_, canvas, column) => `${canvas}·${column}`)

  // The readings keyed from the editions — 音（李范文）, 音（聂历山）, the 藏文對音 — each with the
  // page it stands on. They stand in the readings table like every other reading.
  const keyed = $derived(READING_FIELDS
    .map(field => ({ ...field, value: entry?.pronunciations?.[field.key]?.trim() ?? '', cites: cites(field.key) }))
    .filter(field => field.value))

  const homophones = $derived.by(() => {
    const li = entry?.pronunciations?.li_fanwen?.trim()
    if (!li) return []
    return ix.entries.filter(other => other.char !== char && other.pronunciations?.li_fanwen?.trim() === li).map(other => other.char)
  })
  const users = $derived(ready && char ? [...(ix.usedBy.get(char) ?? [])] : [])
  // The characters whose own spelling is read from this one, either as its upper or its lower.
  const spells = $derived(ready && char ? [...(ix.fanqieUsedBy.get(char) ?? [])].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0)) : [])
  const views = $derived(char && entry?.composition ? idsViews(char, entry.composition, ix.idsIndex) : null)
  // The description's opening, which Find reads as a prefix: the family of characters built from it.
  const opening = $derived(openingOf(entry?.composition))
  const openingCount = $derived(ready && opening ? byDescription(opening).length : 0)

  /** The faces a character can be compared in. All but the first are fetched when asked for, so a
   *  reader who never opens the row pays nothing for the 50 MB of outlines behind it. */
  const FACES = [
    { key: 'noto', name: 'Noto Serif Tangut', short: 'Noto', family: '"Noto Serif Tangut"' },
    { key: 'yinchuan', name: 'Tangut Yinchuan', short: 'Yinchuan', family: '"Tangut Yinchuan"' },
    { key: 'wenhai', name: 'BabelStone Wenhai', short: 'Wenhai', family: '"BabelStone Wenhai"' },
    { key: 'kai', name: 'New Tangut Std', short: 'New Std', family: '"New Tangut Std"' },
    { key: 'genzui', name: 'GenZui Sans', short: 'GenZui', family: '"GenZui Sans"' },
    { key: 'mojikyo', name: 'Mojikyo Tangut', short: 'Mojikyo', family: '"Mojikyo Tangut"' },
    { key: 'n4694', name: 'Tangut N4694', short: 'N4694', family: '"Tangut N4694"' },
    { key: 'twu', name: 'Tangut TWU', short: 'TWU', family: '"Tangut TWU"' },
  ]
  /** @type {string[]} */
  let facesShown = $state([])
  let facesLoading = $state(false)
  async function showFaces() {
    if (facesLoading) return
    facesLoading = true
    for (const face of FACES.slice(1)) {
      if (facesShown.includes(face.key)) continue
      try { await document.fonts.load(`48px ${face.family}`, /** @type {string} */ (char)) } catch { /* the fallback stands in */ }
      facesShown = [...facesShown, face.key]
    }
    facesLoading = false
  }

  /** The hover panel of a character in one of the lists. */
  let peek = $state(/** @type {{ char: string, x: number, y: number } | null} */ (null))
  /** @param {MouseEvent | FocusEvent} event @param {string} other */
  function peekAt(event, other) {
    const box = /** @type {HTMLElement} */ (event.currentTarget).getBoundingClientRect()
    peek = { char: other, x: box.left, y: box.bottom + 6 }
  }

  const first = $derived(ready && char ? gloss(char) : '')
  const address = $derived(char ? `${location.origin}${link('', char)}` : '')

  // The drawer follows one finger on its top bar, and a pull far enough down closes it.
  const CLOSE_AT = 80
  /** @type {{ id: number, y: number, drawer: HTMLElement } | null} */
  let pull = null
  /** @param {PointerEvent & { currentTarget: HTMLElement }} event */
  function grab(event) {
    if (pull || /** @type {Element} */ (event.target).closest('button')) return
    const drawer = event.currentTarget.closest('aside')
    if (!drawer) return
    // A press that began a text selection would turn the next one into a native drag.
    event.preventDefault()
    pull = { id: event.pointerId, y: event.clientY, drawer }
    event.currentTarget.setPointerCapture(event.pointerId)
    drawer.style.transition = 'none'
  }
  /** @param {PointerEvent} event */
  function drag(event) {
    if (pull?.id === event.pointerId) pull.drawer.style.transform = `translateY(${Math.max(0, event.clientY - pull.y)}px)`
  }
  function release() {
    if (!pull) return
    pull.drawer.style.transition = ''
    pull.drawer.style.transform = ''
    pull = null
  }
  /** @param {PointerEvent} event */
  function drop(event) {
    if (pull?.id !== event.pointerId) return
    if (event.type === 'pointerup' && event.clientY - pull.y > CLOSE_AT) ui.sheet = false
    release()
  }
  // Closed some other way in the middle of a pull, the drawer must not keep where the pull left it.
  $effect(() => { if (!ui.sheet) release() })
</script>

{#if ui.sheet}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sheetbar" onpointerdown={grab} onpointermove={drag} onpointerup={drop} onpointercancel={drop} onlostpointercapture={drop}>
    <span class="handle" aria-hidden="true"></span>
    <button class="ui-button close" data-variant="quiet" data-size="sm" type="button" onclick={() => { ui.sheet = false }}>{t('card.close')}</button>
  </div>
{/if}

{#if !char}
  <div class="blank">
    <p class="ui-script blank-glyph" aria-hidden="true">𘅤</p>
    <p class="blank-line">{t('card.blank')}</p>
    <p class="ui-hint">{@html t('card.blankKeys')}</p>
  </div>
{:else if puaVariant}
  {@const base = puaVariant.char}
  <article class="record pua-record" tabindex="-1" bind:this={puaArticle}>
    <header class="head">
      <div class="glyph-frame pua-glyph-frame"><span class="pua-card-glyph" lang="txg" aria-hidden="true">{char}</span></div>
      <div class="facts">
        <button class="cp ui-mono" type="button" title={t('card.copyIdentifier', { id: puaVariant.code })} onclick={() => copy(puaVariant.code, puaVariant.code)}>{puaVariant.code}</button>
        <p class="gloss">{t('card.puaVariant')}</p>
        {#if base}
          <p class="meta">{t('card.puaBase')} <button class="inline pua-base-link" type="button" title={t('find.openCharacter')} onclick={() => choose(base)}><G char={base} /> <span class="ui-mono">{codePoint(base)}</span></button></p>
        {:else}
          <p class="meta">{t('card.puaNoBase')}</p>
        {/if}
      </div>
    </header>

    <div class="use">
      {#if base}<button class="ui-button" data-variant="primary" data-size="sm" type="button" onclick={() => put(base)}><Icon name="add" size={14}/>{t('card.add')}</button>{/if}
      {#if base}<button class="ui-button" data-size="sm" type="button" onclick={() => copy(base)}><Icon name="copy" size={14}/>{t('common.copy')} <span class="ui-script copy-glyph">{base}</span></button>{/if}
      <button class="ui-button" data-size="sm" type="button" onclick={() => copy(puaVariant.code, puaVariant.code)}><Icon name="copy" size={14}/>{t('common.copy')} <span class="ui-mono">{puaVariant.code}</span></button>
      <button class="ui-button" data-size="sm" type="button" onclick={() => copy(address, t('card.link'))}><Icon name="link" size={14}/>{t('card.copyLink')}</button>
      {#if base}<button class="ui-button" data-size="sm" type="button" onclick={() => choose(base)}><Icon name="book" size={14}/>{t('find.openCharacter')}</button>{/if}
    </div>

    <section>
      <h3 class="ui-label"><Icon name="parts" size={15}/>{t('card.builtFrom')}</h3>
      <p class="ui-formula pua-card-ids" title={puaVariant.ids}>{puaVariant.ids}</p>
      {#if puaVariant.sources.length}<p class="ui-hint">{puaVariant.sources.join(' · ')}</p>{:else}<p class="ui-hint">{t('variants.puaNoSource')}</p>{/if}
      <p class="ui-hint">{t('card.puaNote', { version: ix.puaSource?.version ?? '' })}</p>
      <p class="more"><a href={link('variants') + '#pua'}><Icon name="arrow" size={13}/>{t('card.puaVariants')}</a></p>
    </section>
  </article>
{:else}
  <article class="record">
    <header class="head">
      <div class="glyph-frame"><G {char} /></div>
      <div class="facts">
        <button class="cp ui-mono" type="button" title={t('card.copyCodePoint')} onclick={() => copy(codePoint(char))}>{codePoint(char)}</button>
        {#if first}<p class="gloss">{first}</p>{:else if isComponent(char)}<p class="gloss">{t('card.component')}</p>{/if}
        <p class="meta">
          {#if strokes}{t('draw.strokes', { count: strokes })}{/if}{#if entry?.radical}&ensp;·&ensp;{t('card.radical')} <button class="inline ui-script" type="button" onclick={() => choose(/** @type {string} */ (entry?.radical))}>{entry.radical}</button>{/if}
        </p>
      </div>
    </header>

    <div class="use">
      <button class="ui-button" data-variant="primary" data-size="sm" type="button" onclick={() => put(char)}>
        <Icon name="add" size={14}/>
        {t('card.add')}
      </button>
      <button class="ui-button" data-size="sm" type="button" onclick={() => copy(char)}><Icon name="copy" size={14}/>{t('common.copy')} <span class="ui-script copy-glyph">{char}</span></button>
      <button class="ui-button" data-size="sm" type="button" onclick={() => copy(address, t('card.link'))}><Icon name="link" size={14}/>{t('card.copyLink')}</button>
    </div>

    {#if identifiers.length}
      <section class="identifiers">
        <h3 class="ui-label">{t('card.identifiers')}</h3>
        <dl>
          {#each identifiers as group (group.scheme + (group.edition ?? ''))}
            <dt>
              {#if ix.identifierSources[group.scheme]?.url}
                <a href={ix.identifierSources[group.scheme].url} target="_blank" rel="noopener noreferrer" title={t('card.identifierSource')}>{t(group.label)}</a>
              {:else}{t(group.label)}{/if}
              {#if group.edition}<span class="ui-hint">{editionName(group.scheme, group.edition)}</span>{/if}
            </dt>
            <dd>
              {#each group.values as value (value)}
                <button class="identifier ui-mono" type="button" title={t('card.copyIdentifier', { id: value })} onclick={() => copy(value, value)}>{value}</button>
              {/each}
            </dd>
          {/each}
        </dl>
      </section>
    {/if}

    <section class="faces-section">
      <div class="faces-head">
        <h3 class="ui-label"><Icon name="layers" size={15}/>{t('card.renderings')}</h3>
        {#if facesShown.length < FACES.length - 1}
          <button class="ui-button" data-variant="quiet" data-size="sm" type="button" disabled={facesLoading} onclick={showFaces}>
            {#if !facesLoading}<Icon name="layers" size={13}/>{/if}{facesLoading ? t('card.loadingFaces') : t('card.showFaces')}
          </button>
        {/if}
      </div>
      <div class="faces">
        {#each FACES as face, i (face.key)}
          {#if i === 0 || facesShown.includes(face.key)}
            <figure class="face">
              <span class="ui-script face-glyph" style:font-family={face.family} lang="txg">{char}</span>
              <figcaption title={face.name}>{face.short}</figcaption>
            </figure>
          {/if}
        {/each}
      </div>
    </section>

    {#if codes.length}
      <section>
        <h3 class="ui-label"><Icon name="cangjie" size={15}/>{t('nav.cangjie')}</h3>
        <div class="codes">
          {#each codes as code, i (code)}
            <button class="code" type="button" title={t('card.copyCode')} onclick={() => copy(code, code)}>
              <span class="ui-mono">{code}</span><small>{codes.length > 1 ? (i === 0 ? t('card.short') : i === codes.length - 1 ? t('card.full') : '') : ''}</small>
            </button>
          {/each}
          <a class="type" href={link('cangjie', char, codes[0])}><Icon name="keyboard" size={13}/>{t('card.typeIt')}</a>
        </div>
      </section>
    {/if}

    {#if meanings.en?.length || meanings.ja?.length || meanings.zh?.length || entry?.wiktionary_zh?.length || downes || leilin?.length}
      <section>
        <h3 class="ui-label"><Icon name="meaning" size={15}/>{t('card.meaning')}</h3>
        {#if wordClass.length}
          <p class="pos" title={t('card.posSource')}>
            {#each wordClass as key (key)}<span class="ui-tag pos-tag">{t(`pos.${key}`)}</span>{/each}
          </p>
        {/if}
        <dl class="means">
          {#if meanings.en?.length}<dt>en</dt><dd><ol>{#each meanings.en as sense, i (i)}<li>{sense}</li>{/each}</ol></dd>{/if}
          {#if meanings.ja?.length}<dt>ja</dt><dd lang="ja">{meanings.ja.join(' ')}</dd>{/if}
          {#if meanings.zh?.length}
            <dt>zh</dt>
            <dd lang="zh-Hant">
              {meanings.zh.join('；')}
              {#each cites('gloss_zh') as cite (cite.locator)}
                <span class="cite"><b>{bookTitle(cite.work) || cite.note}</b><span class="ui-hint" title={cite.locator}>{place(cite.locator)}</span></span>
              {/each}
            </dd>
          {/if}
          {#if entry?.wiktionary_zh?.length}
            <dt><a href={entry.wiktionary_zh_url ?? `https://zh.wiktionary.org/wiki/${encodeURIComponent(char)}`} target="_blank" rel="noopener noreferrer" title={t('card.chineseWiktionary')}>zh</a></dt>
            <dd lang="zh">{entry.wiktionary_zh.join('；')}</dd>
          {/if}
          {#if leilin?.length}<dt title={t('card.leilinTitle')}>類林</dt><dd lang="zh-Hant">{leilin.map(([word]) => word).join('、')}</dd>{/if}
          {#if downes}<dt class="downes" title={t('card.downesTitle')}>Downes</dt><dd>{downes}</dd>{/if}
        </dl>
      </section>
    {/if}

    {#if variants || derivedForms.length || pua.length}
      <section>
        <h3 class="ui-label"><Icon name="link" size={15}/>{t('card.variants')}</h3>
        {#if variants}
          {#each [
            { source: 'card.variantsSource', rows: [['card.variantOf', variants.of], ['card.variantOfPartial', variants.partial], ['card.variantForms', variants.forms], ['card.variantFormsPartial', variants.partialForms]] },
            { source: 'card.variantReportedSource', rows: [['card.variantReported', variants.reported]] },
            { source: 'card.variantsPossibleSource', rows: [['card.variantPossible', variants.possible]] },
          ] as block (block.source)}
            {#if block.rows.some(([, others]) => others.length)}
              {#each block.rows as [label, others] (label)}
                {#if others.length}
                  <p class="ui-hint">{t(/** @type {string} */ (label))}</p>
                  <div class="ui-tiles rel" style:--ui-tile-size="48px">
                    {#each others as other (other)}
                      {@const sound = readingOf(other, ui.reading)}
                      <button class="ui-tile" type="button" title={gloss(other)} onclick={() => choose(other)}><G char={other} />{#if sound}<span class="ui-tile-sound">{sound}</span>{/if}</button>
                    {/each}
                  </div>
                {/if}
              {/each}
              <p class="ui-hint">{t(block.source)}</p>
            {/if}
          {/each}
        {/if}
        {#if pua.length}
          <p class="ui-hint">{t('card.puaVariants')} <span class="ui-count">{pua.length}</span></p>
          <div class="ui-tiles" style:--ui-tile-size="48px">
            {#each pua as [code, ids, sources] (code + ids)}
              <button class="ui-tile pua-tile" type="button" title={`${code} · ${ids}${sources.length ? ` · ${sources.join(' · ')}` : ''}`} aria-label={`${t('find.openVariant')} · ${code}`} onclick={() => { focusPua = true; choose(puaCharacter(code)) }}>
                <span class="pua-tile-glyph" lang="txg" aria-hidden="true">{puaCharacter(code)}</span>
              </button>
            {/each}
          </div>
        {/if}
        {#if derivedForms.length}
          <p class="ui-hint">{t('card.variantDerived')}</p>
          <ul class="derived">
            {#each derivedForms.slice(0, 6) as description (description)}
              <li><span class="ui-formula" title={description}>{description}</span></li>
            {/each}
          </ul>
          <p class="ui-hint">{t('card.variantDerivedSource')}</p>
        {/if}
        {#if linkedGroup}
          <p class="ui-hint">{t('card.family')}</p>
          <div class="group">
            {#each linkedGroup.links as link (link.one + link.other + link.kind)}
              {@const one = readingOf(link.one, ui.reading)}
              {@const other = readingOf(link.other, ui.reading)}
              <span class="group-link">
                <button class="ui-tile" type="button" aria-current={link.one === char ? 'true' : undefined} title={gloss(link.one)} onclick={() => choose(link.one)}><G char={link.one} />{#if one}<span class="ui-tile-sound">{one}</span>{/if}</button>
                <span class="chain-tie" aria-hidden="true"></span>
                <button class="ui-tile" type="button" aria-current={link.other === char ? 'true' : undefined} title={gloss(link.other)} onclick={() => choose(link.other)}><G char={link.other} />{#if other}<span class="ui-tile-sound">{other}</span>{/if}</button>
                <span class="ui-tag">{t(`variants.link.${link.ground}`)}</span>
              </span>
            {/each}
          </div>
        {/if}
        <p class="more"><a href={link('variants', char)}><Icon name="arrow" size={13}/>{t('card.variantsAll')}</a></p>
      </section>
    {/if}

    {#if hasCardReadings({ readings, keyed, rhymeClass, spelling, hands, glosses: tibetanGlosses })}
      <section>
        <h3 class="ui-label"><Icon name="reading" size={15}/>{t('card.readings')}</h3>
        <table class="readings">
          <tbody>
            {#each readings as reading (reading.key)}
              <tr>
                <th scope="row" title={systemTitle(reading)}>{systemName(reading, i18n.locale)}</th>
                <td>
                  {reading.value}
                  {#each cites(reading.key) as cite (cite.locator)}
                    <span class="cite"><b>{bookTitle(cite.work) || cite.note}</b><span class="ui-hint" title={cite.locator}>{place(cite.locator)}</span></span>
                  {/each}
                </td>
              </tr>
            {/each}
            {#each keyed as field (field.key)}
              <tr>
                <th scope="row" title={field.name ? `${field.name} · ${field.zh}` : fieldLabel(field)}>{fieldLabel(field)}</th>
                <td class:cjk={field.lang !== 'bo'}>
                  <span class:bo={field.lang === 'bo'} lang={field.lang}>{field.value}</span>
                  {#each field.cites as cite (cite.locator)}
                    <span class="cite"><b>{bookTitle(cite.work) || cite.note}</b><span class="ui-hint" title={cite.locator}>{place(cite.locator)}</span></span>
                  {/each}
                </td>
              </tr>
            {/each}
            {#if rhymeClass}
              <tr><th scope="row">{t('card.rhyme')}</th><td>{rhymeClass}{#if toneName}<span class="ui-hint"> · {t(toneName)}</span>{/if}</td></tr>
            {/if}
            {#if spelling}
              <tr><th scope="row">{t('card.fanqie')}</th><td class="cjk"><span class="ui-script spelling">{spelling}</span></td></tr>
            {/if}
            {#if hands?.tibetan?.length || tibetanGlosses.length}
              <tr><th scope="row">{t('card.tibetanHands')}</th><td>
                <div class="tibetan-sources">
                  {#if hands?.tibetan?.length}
                    <div class="tibetan-source">
                      <a class="source-label ui-hint" href="https://zhuanlan.zhihu.com/p/272058247" target="_blank" rel="noopener noreferrer" title={t('card.handsTitle')}>{t('card.spellingSource')}<span aria-hidden="true">↗</span></a>
                      <div class="hands">
                        {#each hands.tibetan as [hand, printed, count, script, wylie, ipa] (hand + script + count + wylie)}
                          <Spelling {script} transcription={wylie} {ipa} lang="bo" {printed} {hand} {count} babelstone pua={setaCode(ix.seta, script)} />
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if tibetanGlosses.length}
                    <div class="tibetan-source">
                      <a class="source-label ui-hint" href="https://www.babelstone.co.uk/Tangut/TangutTibetanIndex.html" target="_blank" rel="noopener noreferrer">{t('card.transcriptionTibetan')}<span aria-hidden="true">↗</span></a>
                      <div class="tibetan-glosses">
                        {#each tibetanGlosses as [wylie, script, where], i (i)}
                          <span class="tibetan-gloss">
                            <span lang="bo" class="tibetan-script">{tibetanShown(script)}</span>
                            <span class="ui-mono wylie">{wylie}</span>
                            <span class="ui-hint">{tibetanWhere(where)}</span>
                          </span>
                        {/each}
                        <span class="source-note ui-hint">{t('card.transcriptionTibetanNote')}</span>
                      </div>
                    </div>
                  {/if}
                </div>
              </td></tr>
            {/if}
            {#if hands?.sanskrit?.length}
              <tr><th scope="row">{t('card.sanskrit')}</th><td class="hands">
                {#each hands.sanskrit as [printed, script, ipa] (printed)}
                  <Spelling {script} transcription={printed} {ipa} lang="sa" />
                {/each}
              </td></tr>
            {/if}
          </tbody>
        </table>
      </section>
    {/if}

    {#if ready && ix.zzz.has(char)}
      <section>
        <h3 class="ui-label"><Icon name="sound" size={15}/>{t('card.transcriptions')}</h3>
        <dl class="transcriptions">
          {#if ix.zzz.has(char)}
            <dt><a href="https://kokusho.nijl.ac.jp/biblio/100354804" target="_blank" rel="noopener noreferrer">{t('card.transcriptionZzz')}<span aria-hidden="true">↗</span></a></dt>
            <dd class="zzz">
              {#each ix.zzz.get(char) ?? [] as pair, i (pair.entry + pair.text)}{#if i}<span class="sep" aria-hidden="true">·</span>{/if}<span class="zzz-pair"><span lang="zh-Hant" title={pair.entry}>{pair.text}</span><span class="entry-ref ui-hint">{t('card.transcriptionEntry', { id: (pair.entry.split(':').pop() ?? '') })}</span></span>{/each}
              <span class="source-note ui-hint">{t('card.transcriptionZzzNote')}</span>
            </dd>
          {/if}
        </dl>
      </section>
    {/if}

    {#if !isComponent(char)}
      <section>
        <h3 class="ui-label"><Icon name="link" size={15}/>{t('card.ccamc')}</h3>
        <p class="ui-hint">{t('card.ccamcNote')}</p>
        <p><a class="ccamc-link" href={ccamcUrl(char)} target="_blank" rel="noopener noreferrer">{t('common.ccamc')}<span aria-hidden="true">↗</span></a></p>
      </section>
    {/if}

    {#if entry?.wenhai_text_zh}
      <section>
        <h3 class="ui-label"><Icon name="scroll" size={15}/>{t('card.wenhai')}</h3>
        <p lang="zh-Hant">
          {entry.wenhai_text_zh}
          {#each cites('wenhai_zh') as cite (cite.locator)}
            <span class="cite"><b>{bookTitle(cite.work) || cite.note}</b><span class="ui-hint" title={cite.locator}>{place(cite.locator)}</span></span>
          {/each}
        </p>
      </section>
    {/if}

    {#if construction}
      <section>
        <h3 class="ui-label"><Icon name="scroll" size={15}/>{t('card.wenhaiConstruction')}<span class="wenhai-position ui-hint">{construction.position}</span></h3>
        <p class="wenhai-construction">
          {#each construction.parts as [source, part], i}
            {#if i > 0}<span class="wenhai-sep" aria-hidden="true">·</span>{/if}
            <span class="wenhai-part">{#if part}<span class="wenhai-term" lang="zh-Hant">{partTerm(part)}</span>{/if}<button class="inline wenhai-source" type="button" title={gloss(source) || undefined} aria-label={gloss(source) || source} onclick={() => choose(source)}><G char={source} /></button></span>
          {/each}
        </p>
      </section>
    {/if}

    <section>
      <h3 class="ui-label"><Icon name="parts" size={15}/>{t('card.builtFrom')}</h3>
      {#if views}
        {#each [
          ...(views.showEditorial ? [{ label: t('card.idsEditorial'), recorded: false, text: views.editorial, parts: views.editorialParts }] : []),
          { label: t('card.idsRecorded'), recorded: true, text: views.recorded, parts: views.recordedParts },
        ] as view (view.recorded)}
          <div class="ids-view">
            <h4 class="ui-hint">{view.label}</h4>
            <Ids composition={view.text} />
            <p class="ids">
              <span class="ui-formula" title={view.text}>{view.text}</span>
              <button class="ui-button" data-variant="quiet" data-size="sm" type="button" title={t('card.copyDescription')} aria-label={`${t('common.copy')} · ${t(view.label)}`} onclick={() => copy(view.text, t('card.description'))}><Icon name="copy" size={13}/>{t('common.copy')}</button>
              {#if view.parts.length}<a class="ids-link" aria-label={`${t('card.withTheseParts')} · ${t(view.label)}`} href={link('parts', char, view.parts.join(''))}><Icon name="parts" size={13}/>{t('card.withTheseParts')}</a>{/if}
              {#if view.recorded && openingCount > 1}<a class="ids-link" href={link('', char, opening)}><Icon name="find" size={13}/>{t('card.sameOpening')}</a>{/if}
            </p>
          </div>
        {/each}
        <p class="ui-hint">{t('card.idsSource')} <a href="https://www.babelstone.co.uk/Tangut/TangutIDS.txt" target="_blank" rel="noopener noreferrer">Andrew West, Tangut IDS ↗</a>.{#if views.showEditorial}{' '}{t('card.idsMethod')}{/if}</p>
      {:else if isComponent(char)}
        <p class="ui-hint">{t('card.isComponent')}</p>
      {:else}
        <p class="ui-hint">{t('card.noDescription')}</p>
      {/if}
    </section>

    <Attest {char} />

    {#if users.length}
      <section>
        <h3 class="ui-label"><Icon name="link" size={15}/>{t('card.usedIn', { count: users.length })}</h3>
        <div class="ui-tiles rel" style:--ui-tile-size="48px">
          {#each users.slice(0, 48) as other (other)}
            {@const sound = readingOf(other, ui.reading)}
            <button class="ui-tile" type="button" title={gloss(other)} onclick={() => choose(other)}><G char={other} />{#if sound}<span class="ui-tile-sound">{sound}</span>{/if}</button>
          {/each}
        </div>
        {#if users.length > 48}<p class="more"><a href={link('parts', char, char)}><Icon name="arrow" size={13}/>{t('card.allInParts', { count: users.length })}</a></p>{/if}
      </section>
    {/if}

    {#if same.length}
      <section>
        <h3 class="ui-label"><Icon name="parts" size={15}/>{t('card.sameDescription')}</h3>
        <div class="ui-tiles rel" style:--ui-tile-size="48px">
          {#each same as other (other)}
            {@const sound = readingOf(other, ui.reading)}
            <button class="ui-tile" type="button" title={gloss(other)} onclick={() => choose(other)}
              onmouseenter={event => peekAt(event, other)} onmouseleave={() => { peek = null }} onfocus={event => peekAt(event, other)} onblur={() => { peek = null }}>
              <G char={other} />{#if sound}<span class="ui-tile-sound">{sound}</span>{/if}<TileNote char={other} text={gloss(other)} />
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if spells.length}
      <section>
        <h3 class="ui-label"><Icon name="fanqie" size={15}/>{t('card.fanqieFor', { count: spells.length })}</h3>
        <div class="ui-tiles rel" style:--ui-tile-size="48px">
          {#each spells.slice(0, 48) as other (other)}
            {@const sound = readingOf(other, ui.reading)}
            <button class="ui-tile" type="button" title={gloss(other)} onclick={() => choose(other)}
              onmouseenter={event => peekAt(event, other)} onmouseleave={() => { peek = null }} onfocus={event => peekAt(event, other)} onblur={() => { peek = null }}>
              <G char={other} />{#if sound}<span class="ui-tile-sound">{sound}</span>{/if}<TileNote char={other} text={gloss(other)} />
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if homophones.length}
      <section>
        <h3 class="ui-label"><Icon name="sound" size={15}/>{t('card.sameReading')}</h3>
        <div class="ui-tiles rel" style:--ui-tile-size="48px">
          {#each homophones.slice(0, 48) as other (other)}
            {@const sound = readingOf(other, ui.reading)}
            <button class="ui-tile" type="button" title={gloss(other)} onclick={() => choose(other)}
              onmouseenter={event => peekAt(event, other)} onmouseleave={() => { peek = null }} onfocus={event => peekAt(event, other)} onblur={() => { peek = null }}>
              <G char={other} />{#if sound}<span class="ui-tile-sound">{sound}</span>{/if}<TileNote char={other} text={gloss(other)} />
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if peek}<Peek char={peek.char} x={peek.x} y={peek.y} />{/if}

    <footer class="credit ui-hint">
      {t('card.credit')}
      <a href="/about">{t('nav.sources')}</a>
    </footer>
  </article>
{/if}

<style>
  .sheetbar{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;align-items:center;min-block-size:44px;padding:var(--ui-space-2xs) var(--ui-space-sm);background:var(--ui-color-surface);border-bottom:1px solid var(--ui-color-border);touch-action:none;cursor:grab;user-select:none}
  @media (min-width:901px){.sheetbar{display:none}}
  .handle{position:absolute;inset-block-start:8px;inset-inline-start:50%;inline-size:40px;block-size:4px;border-radius:2px;background:var(--ui-color-border-strong);transform:translateX(-50%)}
  .blank{display:grid;gap:var(--ui-space-md);justify-items:center;text-align:center;padding:72px var(--ui-space-3xl);color:var(--ui-color-ink-soft)}
  .blank-glyph{font-size:88px;color:var(--ui-color-border-strong);line-height:1}
  .blank-line{max-inline-size:24em}
  .blank .ui-hint{max-inline-size:26em}
  .record{display:block;padding:var(--ui-space-2xl) var(--ui-space-2xl) var(--ui-space-5xl)}
  .head{display:flex;align-items:center;gap:var(--ui-space-xl);padding-bottom:var(--ui-space-xl)}
  .glyph-frame{position:relative;display:grid;place-items:center;flex:none;inline-size:116px;block-size:116px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface-sunken)}
  .glyph-frame::before,.glyph-frame::after{content:'';position:absolute;background:var(--ui-color-border);pointer-events:none}
  .glyph-frame::before{left:50%;top:9px;bottom:9px;width:1px}
  .glyph-frame::after{top:50%;left:9px;right:9px;height:1px}
  .glyph-frame :global(.ui-script){position:relative;z-index:1;font-size:88px}
  .pua-glyph-frame :global(.pua-card-glyph){position:relative;z-index:1;font-family:'Tangut PUA',var(--tg-font);font-size:82px;line-height:1}
  .pua-card-ids{font-size:24px;line-height:1.5;overflow-wrap:anywhere}
  .pua-base-link{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer}
  .pua-base-link :global(.ui-script){font-size:30px;line-height:1}
  .pua-base-link:hover,.pua-base-link:focus-visible{background:var(--ui-color-accent-soft)}
  .glyph-frame :global(.ui-nog){position:relative;z-index:1;font-size:var(--ui-text-sm);inline-size:3.4em;block-size:3.4em}
  .facts{display:grid;gap:var(--ui-space-2xs);min-inline-size:0}
  .cp{display:inline-flex;align-items:center;justify-self:start;min-block-size:24px;margin-inline-start:-6px;padding:2px 6px;border:0;border-radius:var(--ui-radius-xs);background:none;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .cp:hover{background:var(--ui-color-surface-hover);color:var(--ui-color-ink)}
  .gloss{font-family:var(--ui-font-serif);font-size:var(--ui-text-xl);line-height:var(--ui-leading-tight)}
  .meta{color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs)}
  .inline{padding:0 3px;border:0;border-radius:var(--ui-radius-xs);background:none;color:inherit;font-size:17px;vertical-align:-2px}
  .inline:hover{background:var(--ui-color-surface-hover)}
  .use{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs);padding-bottom:var(--ui-space-xl)}
  .pua-tile{content-visibility:auto;contain-intrinsic-size:48px 48px}
  .pua-tile .pua-tile-glyph{font-family:'Tangut PUA',var(--tg-font);font-size:30px;line-height:1}
  .pua-record:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:-2px}
  .identifiers dl{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:var(--ui-space-2xs) var(--ui-space-lg);margin:0}
  .identifiers dt{display:flex;align-items:baseline;gap:var(--ui-space-2xs);color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);white-space:nowrap}
  .identifiers dt a{display:inline-flex;align-items:center;gap:1px;color:inherit;text-underline-offset:2px}
  .identifiers dd{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs);margin:0;min-inline-size:0}
  .identifier{padding:1px 6px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xs);background:var(--ui-color-surface-sunken);color:var(--ui-color-ink);font:inherit;font-size:var(--ui-text-xs);line-height:1.6;cursor:pointer}
  .identifier:hover{border-color:var(--ui-color-border-strong);background:var(--ui-color-surface-hover)}
  .faces-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--ui-space-sm)}
  .record section > .ui-label,.faces-head .ui-label{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .more a{display:inline-flex;align-items:center;gap:3px}
  .faces{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:var(--ui-space-2xs)}
  .group{display:grid;gap:var(--ui-space-xs);margin-block-end:var(--ui-space-sm)}
  .group-link{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs)}
  .chain-tie{inline-size:12px;block-size:1px;background:var(--ui-color-border-strong)}
  .group-link .ui-tile[aria-current='true']{background:var(--ui-color-accent-soft)}
  .face{display:grid;place-items:center;gap:2px;margin:0;padding:var(--ui-space-xs) 2px var(--ui-space-2xs);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface-sunken);min-inline-size:0}
  .face-glyph{font-size:32px;line-height:1.15}
  .face figcaption{max-inline-size:100%;overflow:hidden;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);line-height:1.2;text-align:center;text-overflow:ellipsis;white-space:nowrap}
  .copy-glyph{font-size:16px;line-height:1}
  section{display:grid;gap:var(--ui-space-sm);padding-block:var(--ui-space-xl);border-top:1px solid var(--ui-color-border)}
  .codes{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs)}
  .code{display:inline-flex;align-items:baseline;gap:6px;padding:4px 8px;border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface-sunken);font-size:var(--ui-text-md)}
  .code:hover{border-color:var(--ui-color-ink-muted)}
  .code small{font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted)}
  .code small:empty{display:none}
  .type{display:inline-flex;align-items:center;gap:3px;min-block-size:24px;padding-inline:2px;font-size:var(--ui-text-xs);margin-inline-start:var(--ui-space-2xs)}
  .ccamc-link{display:inline-flex;align-items:center;gap:4px;font-size:var(--ui-text-sm);font-weight:var(--ui-weight-semibold);text-underline-offset:2px}
  .means{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:var(--ui-space-xs) var(--ui-space-sm);margin:0}
  .means dt{color:var(--ui-color-ink-muted);font-family:var(--ui-font-mono);font-size:var(--ui-text-2xs);font-weight:var(--ui-weight-semibold);line-height:1.9;text-transform:uppercase}
  .means dd{margin:0;font-size:var(--ui-text-md);line-height:var(--ui-leading-normal)}
  .means ol{margin:0;padding-inline-start:1.2em}
  .readings{border-collapse:collapse;inline-size:100%;font-size:var(--ui-text-sm)}
  .readings th{inline-size:46%;padding:var(--ui-space-2xs) var(--ui-space-sm) var(--ui-space-2xs) 0;text-align:start;font-weight:var(--ui-weight-normal);color:var(--ui-color-ink-muted);vertical-align:top}
  .readings td{padding:var(--ui-space-2xs) 0;font-family:var(--ui-font-phonetic);font-size:var(--ui-text-md)}
  .readings td.cjk{font-family:var(--ui-font-sans);font-size:var(--ui-text-sm)}
  .readings .hands{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px var(--ui-space-xs);font-family:var(--ui-font-sans);font-size:var(--ui-text-sm)}
  .tibetan-sources{display:grid;gap:var(--ui-space-sm)}
  .tibetan-source{display:grid;gap:2px}
  .source-label{width:fit-content;text-underline-offset:2px}
  .readings tr + tr{border-top:1px solid var(--ui-color-border)}
  .cite{display:block;margin-block-start:2px;font-family:var(--ui-font-sans);font-size:var(--ui-text-xs);color:var(--ui-color-ink-muted)}
  .spelling{font-size:18px}
  .transcriptions{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:var(--ui-space-xs) var(--ui-space-lg);margin:0;align-items:baseline}
  .transcriptions dt{color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm)}
  .transcriptions dt a{display:inline-flex;align-items:center;gap:3px;color:inherit;text-underline-offset:2px}
  .transcriptions dd{margin:0;min-inline-size:0}
  .transcriptions .zzz{font-size:var(--ui-text-xl);line-height:1.3}
  .zzz-pair{display:inline-flex;align-items:baseline;gap:var(--ui-space-xs)}
  .zzz-pair .entry-ref{font-size:var(--ui-text-2xs)}
  .transcriptions .sep{margin-inline:0.4em;color:var(--ui-color-ink-muted)}
  .tibetan-glosses{display:grid;gap:2px}
  .tibetan-gloss{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--ui-space-2xs) var(--ui-space-sm)}
  .tibetan-script{font-family:'Noto Serif Tibetan','Noto Sans Tibetan',Kailasa,'Microsoft Himalaya','Jomolhari',serif;font-size:var(--ui-text-lg);line-height:1.35}
  .tibetan-gloss .wylie{font-size:var(--ui-text-sm);color:var(--ui-color-ink)}
  .tibetan-gloss .ui-hint{font-size:var(--ui-text-2xs)}
  .source-note{display:block;margin-top:2px;font-size:var(--ui-text-2xs);line-height:1.35}
  .pos{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs)}
  .pos-tag{text-transform:none;font-family:var(--ui-font-sans);font-size:var(--ui-text-2xs)}
  .ids-view{display:grid;gap:var(--ui-space-xs);min-inline-size:0}
  .ids{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs) var(--ui-space-md);font-size:var(--ui-text-sm)}
  .ids .ui-formula{font-size:20px}
  .ids-link{display:inline-flex;align-items:center;gap:3px;min-block-size:24px;padding-inline:2px;font-size:var(--ui-text-xs)}
  .wenhai-construction{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs) var(--ui-space-md);margin:0;font-size:var(--ui-text-lg)}
  .wenhai-part{display:inline-flex;align-items:center;gap:5px}
  .wenhai-part :global(.ui-script){font-size:22px;line-height:1}
  .wenhai-term{color:var(--ui-color-ink-muted);font-family:var(--ui-font-serif);font-size:var(--ui-text-sm)}
  .wenhai-sep{color:var(--ui-color-ink-muted)}
  .wenhai-position{margin-inline-start:auto;font-size:var(--ui-text-2xs);letter-spacing:0}
  .derived{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs);margin:var(--ui-space-xs) 0 0;padding:0;list-style:none}
  .derived .ui-formula{font-size:16px}
  .rel{gap:3px}
  .rel :global(.ui-script){font-size:26px}
  .more{font-size:var(--ui-text-xs)}
  .credit{border-top:1px solid var(--ui-color-border);padding-top:var(--ui-space-lg);font-size:var(--ui-text-2xs);line-height:1.6;margin-top:var(--ui-space-xl)}
  @media (max-width:560px){
    .identifiers dl{grid-template-columns:1fr;gap:2px}
    .identifiers dt{white-space:normal}
    .identifiers dd{margin-bottom:var(--ui-space-xs)}
  }
  @media (max-width:900px){
    .record{padding:var(--ui-space-lg) var(--ui-space-lg) var(--ui-space-5xl)}
    .head{gap:var(--ui-space-lg)}
    .glyph-frame{inline-size:96px;block-size:96px}
    .glyph-frame :global(.ui-script){font-size:72px}
    .pua-glyph-frame :global(.pua-card-glyph){font-size:68px}
    .pua-card-ids{font-size:20px}
    .gloss{font-size:var(--ui-text-lg)}
  }
</style>
