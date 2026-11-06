<script>
  // Every variant form the site records, in the groups the card shows them in, each with what supports
  // it, and the variant components with where each stands in a character.
  import VARIANTS from '../data/tangut-variants.json' with { type: 'json' }
  import { db, ix, hex, readingOf } from '../lib/db.svelte.js'
  import { componentPositions } from '../lib/variants.js'
  import { choose, ui } from '../lib/ui.svelte.js'
  import { route } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import G from '../ui/G.svelte'
  import Icon from '../ui/Icon.svelte'

  const ready = $derived(db.status === 'ready')
  const possible = $derived(ready ? ix.variantPairs : [])
  const positions = $derived(ready ? componentPositions(ix.entries) : new Map())
  const stated = [
    ...VARIANTS.variants.map(([form, base, revisions]) => ({ form, base, revisions, partial: false })),
    ...VARIANTS.partial.map(([form, base, revisions]) => ({ form, base, revisions, partial: true })),
  ]

  /** @param {string} revisions Each page's revision, as `wiki:revision`. */
  const links = revisions => revisions.split(',').map(entry => {
    const [wiki, revision] = entry.split(':')
    return { wiki, url: `https://${wiki}.wiktionary.org/w/index.php?oldid=${revision}` }
  })
</script>

{#snippet char(/** @type {string} */ value)}
  {@const sound = readingOf(value, ui.reading)}
  <button type="button" class="char" aria-current={route.c === value ? 'true' : undefined} aria-label={t('eras.open', { char: value, code: hex(value) })} title={sound} onclick={() => choose(value)}><G char={value} /></button>
{/snippet}

{#snippet heading(/** @type {string} */ key, /** @type {number} */ count)}
  <h2 class="heading">{t(key)} <span class="ui-tag">{count}</span></h2>
{/snippet}

<article class="ui-page variants">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="link" size={22}/><span>{t('card.variants')}</span></h1>
    <p class="ui-page-intro">{t('variants.intro')}</p>
  </header>

  <section class="ui-section" id="stated">
    {@render heading('variants.stated', stated.length)}
    <div class="ui-table-wrap">
      <table class="ui-table list">
        <thead><tr><th scope="col">{t('variants.form')}</th><th scope="col">{t('variants.base')}</th><th scope="col">{t('variants.source')}</th></tr></thead>
        <tbody>
          {#each stated as row (row.form + row.base)}
            <tr>
              <td>{@render char(row.form)}</td>
              <td>{@render char(row.base)}</td>
              <td><span class="source">
                {#each links(row.revisions) as source (source.wiki)}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.wiki}</a>{/each}
                {#if row.partial}<span class="ui-tag">{t('variants.partial')}</span>{/if}
              </span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="ui-section" id="reported">
    {@render heading('variants.reported', VARIANTS.reported.length)}
    <p class="ui-hint">{t('card.variantReportedSource')}</p>
    <div class="ui-table-wrap">
      <table class="ui-table list">
        <thead><tr><th scope="col">{t('variants.form')}</th><th scope="col">{t('variants.form')}</th></tr></thead>
        <tbody>
          {#each VARIANTS.reported as [one, other] (one + other)}
            <tr><td>{@render char(one)}</td><td>{@render char(other)}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="ui-section" id="possible">
    {@render heading('card.variantPossible', possible.length)}
    <p class="ui-hint">{t('card.variantsPossibleSource')}</p>
    <div class="ui-table-wrap">
      <table class="ui-table list">
        <thead><tr><th scope="col">{t('variants.form')}</th><th scope="col">{t('variants.form')}</th><th scope="col">{t('variants.reading')}</th><th scope="col">{t('variants.ground')}</th></tr></thead>
        <tbody>
          {#each possible as pair (pair.one + pair.other)}
            <tr>
              <td>{@render char(pair.one)}</td>
              <td>{@render char(pair.other)}</td>
              <td class="reading">{pair.reading}</td>
              <td>{#if pair.components}<span class="ui-tag">{t('variants.ground.component')}</span> <span class="pair" aria-hidden="true">{#each [...pair.components] as part (part)}<G char={part} />{/each}</span>{:else}<span class="ui-tag">{t('variants.ground.sense')}</span>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="ui-section" id="components">
    {@render heading('variants.components', VARIANTS.groups.length)}
    <p class="ui-hint">{t('variants.components.hint')}</p>
    <div class="ui-table-wrap">
      <table class="ui-table list">
        <thead><tr><th scope="col">{t('variants.kind')}</th><th scope="col">{t('variants.form')}</th><th scope="col">{t('variants.positions')}</th></tr></thead>
        <tbody>
          {#each VARIANTS.groups as group (group.members)}
            {#each [...group.members] as member, i (member)}
              <tr>
                {#if i === 0}<td rowspan={[...group.members].length}><span class="ui-tag">{t(`variants.kind.${group.kind}`)}</span></td>{/if}
                <td>{@render char(member)}</td>
                <td><span class="places">
                  {#each Object.entries(positions.get(member) ?? {}) as [place, count] (place)}<span class="place">{t(`variants.place.${place}`)} <b>{count}</b></span>{/each}
                </span></td>
              </tr>
            {/each}
          {/each}
        </tbody>
      </table>
    </div>
  </section>
</article>

<style>
  .variants{gap:var(--ui-space-xl);padding-bottom:var(--ui-space-5xl)}
  .heading{display:flex;align-items:center;gap:var(--ui-space-sm)}
  .char{padding:0 2px;border:0;border-radius:var(--ui-radius-sm);background:none;color:inherit;font:inherit;cursor:pointer}
  .char :global(.ui-script){font-size:30px;line-height:1.2}
  .char:hover,.char[aria-current='true']{background:var(--ui-color-accent-soft)}
  .source{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-sm)}
  .reading{font-variant-numeric:tabular-nums;white-space:nowrap}
  .pair{display:inline-flex;gap:2px;vertical-align:middle}
  .places{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs) var(--ui-space-md);font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft)}
  .place b{font-weight:var(--ui-weight-semibold);color:var(--ui-color-ink);font-variant-numeric:tabular-nums}
</style>
