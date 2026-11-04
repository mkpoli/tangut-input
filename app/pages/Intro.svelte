<script>
  // A short encyclopedia entry on the page's subject: the people, their state, the script, the
  // language, the texts and the script today. The text lives in the message catalogues, in the
  // reader's language; the numbered citations resolve to the list at the foot, which is shared.
  import { t } from '../lib/i18n.svelte.js'
  import { SOURCES } from '../lib/intro-sources.js'

  /** The article's sections, in order; their text is `intro.s1` … `intro.s5`. */
  const SECTIONS = ['people', 'script', 'language', 'texts', 'after-1227']

  /** @param {string} body */
  const paragraphs = body => body.split('\n\n').map(text => text.trim()).filter(Boolean)

  /**
   * A paragraph cut into its text and its citation numbers, so a citation can be a link to the
   * source list and the text around it stays text. Runs of citations become one mark: ¹,².
   * @param {string} text
   * @returns {({ text: string } | { ns: number[] })[]}
   */
  function parts(text) {
    /** @type {({ text: string } | { ns: number[] })[]} */
    const out = []
    for (const chunk of text.split(/(\[\d+\])/).filter(Boolean)) {
      const citation = chunk.match(/^\[(\d+)\]$/)
      if (!citation) {
        const last = out.at(-1)
        if (last && 'text' in last) last.text += chunk
        else out.push({ text: chunk })
        continue
      }
      const n = Number(citation[1])
      const last = out.at(-1)
      if (last && 'ns' in last) last.ns.push(n)
      else out.push({ ns: [n] })
    }
    // The space before a citation goes; the mark sits against the word it follows.
    return out.map(part => 'text' in part ? { text: part.text.replace(/\s+$/, '') } : part)
      .filter(part => !('text' in part) || part.text)
  }
</script>

<article class="ui-page intro" data-width="narrow">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('intro.title')}</h1>
    <p class="ui-page-intro">{#each parts(t('intro.lead')) as part}{#if 'ns' in part}<sup class="cite">{#each part.ns as n, i}{#if i}<span class="sep">,</span>{/if}<a href={`#source-${n}`} title={SOURCES[n - 1]?.title}>{n}</a>{/each}</sup>{:else}{part.text}{/if}{/each}</p>
  </header>

  {#each SECTIONS as id, index (id)}
    <section class="ui-section" id={id}>
      <h2 class="intro-heading">{t(`intro.s${index + 1}.heading`)}</h2>
      {#each paragraphs(t(`intro.s${index + 1}.body`)) as paragraph}
        <p class="intro-para">{#each parts(paragraph) as part}{#if 'ns' in part}<sup class="cite">{#each part.ns as n, i}{#if i}<span class="sep">,</span>{/if}<a href={`#source-${n}`} title={SOURCES[n - 1]?.title}>{n}</a>{/each}</sup>{:else}{part.text}{/if}{/each}</p>
      {/each}
    </section>
  {/each}

  <p class="intro-para intro-close">{t('intro.close')}</p>
  <p class="intro-start"><a href="/">{t('intro.start')}</a></p>

  <section class="ui-section sources" id="sources">
    <h2 class="intro-heading">{t('intro.sources')}</h2>
    <ol class="source-list">
      {#each SOURCES as source (source.n)}
        <li id={`source-${source.n}`}>
          {source.author}. <a href={source.url}><i>{source.title}</i></a>. {source.publisher}{source.year ? `, ${source.year}` : ''}{source.accessed ? `, accessed ${source.accessed}` : ''}{#if source.licence}{#if source.licenceUrl} · <a href={source.licenceUrl}>{source.licence}</a>{:else} · {source.licence}{/if}{/if}
        </li>
      {/each}
    </ol>
  </section>
</article>

<style>
  .intro{gap:var(--ui-space-2xl);padding-bottom:var(--ui-space-5xl)}
  .intro-heading{font-family:var(--ui-font-serif);font-size:var(--ui-text-xl);font-weight:var(--ui-weight-semibold);line-height:1.3}
  .intro-para{max-inline-size:68ch;color:var(--ui-color-ink);font-size:var(--ui-text-md);line-height:var(--ui-leading-loose)}
  .intro-close{max-inline-size:68ch;font-family:var(--ui-font-serif);font-size:var(--ui-text-lg)}
  .intro-start{margin:0}
  .intro-start a{color:var(--ui-color-accent);font-size:var(--ui-text-sm);text-underline-offset:3px}
  .cite{font-size:.72em;line-height:0;vertical-align:super}
  .cite .sep{margin-inline-end:1px}
  .cite a{padding-inline:1px;color:var(--ui-color-accent);text-decoration:none}
  .cite a:hover{text-decoration:underline}
  .sources{gap:var(--ui-space-sm);padding-top:var(--ui-space-xl);border-top:1px solid var(--ui-color-border)}
  .source-list{margin:0;padding-inline-start:1.5em;color:var(--ui-color-ink-soft);font-size:13px;line-height:1.65}
  .source-list li{padding-block:2px 6px;padding-inline-start:2px}
  .source-list li::marker{color:var(--ui-color-ink-muted)}
  .source-list li{scroll-margin-block-start:calc(var(--topbar-h) + var(--ui-space-lg))}
  .source-list li:target{color:var(--ui-color-ink)}
  .source-list a{color:inherit;text-underline-offset:2px}

  :global(html[lang='ko']) .intro-para,
  :global(html[lang='ko']) .intro-close,
  :global(html[lang='ko']) .ui-page-intro,
  :global(html[lang='ko']) .source-list{word-break:keep-all}
  @media (max-width: 900px){
    .intro{gap:var(--ui-space-xl)}
    .intro-para,.intro-close{font-size:var(--ui-text-sm)}
  }
</style>
