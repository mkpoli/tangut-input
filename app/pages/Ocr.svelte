<script>
  // The attempts to read Tangut by machine, oldest first, with the one sample this site can still
  // put three readers through. Reported figures are the authors' own and stay beside their sets.
  import { ATTEMPTS, MEASURED, ENTRIES, LAST_CHECKED } from '../lib/ocr-arena.js'

  /** @param {number} value */
  const percent = value => `${(value * 100).toFixed(1)}%`

  /** @param {import('../lib/ocr-arena.js').Attempt} attempt */
  const tags = attempt => [
    attempt.code ? 'code' : '',
    attempt.weights ? 'weights' : '',
    attempt.demo ? 'demo' : '',
  ].filter(Boolean)
</script>

<article class="ui-page ocr" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">Reading Tangut by machine</h1>
    <p class="ui-page-intro">Attempts to recognise Tangut since 2011, with what each one reads, the
      terms it comes under, and the score its author reports. Three runs are measured here on the
      same 24 printed signs.</p>
  </header>

  <section class="ui-section">
    <div class="section-head">
      <h2>Measured on one page</h2>
      <span class="ui-count">{MEASURED[0].total} signs</span>
    </div>
    <p class="note">Six Tangut columns of 番漢合時掌中珠, canvas 40 band 1. Exact code point, top-1.
      Tesseract reads one glyph; mixocr reads one glyph; the band reader cuts each column into four
      and reads the strip. <a href="https://github.com/mkpoli/tangut-input/blob/main/benchmark/ocr/README.md">Protocol</a>.</p>

    <div class="runs">
      {#each MEASURED as run (run.name)}
        <div class="run" class:ours={run.ours}>
          <div class="run-name"><b>{run.name}</b><span>{run.note} · {run.terms}</span></div>
          <div class="bar" aria-hidden="true"><i style={`--v:${run.score / run.total}`}></i></div>
          <span class="right">{run.score}/{run.total}</span>
          <span class="pct">{percent(run.score / run.total)}</span>
        </div>
      {/each}
    </div>

    <div class="matrix" role="table" aria-label="The 24 signs, and which runs read each one">
      {#each ENTRIES as entry, index (entry[0].column)}
        <div class="row" role="row">
          <span class="column ui-mono" role="rowheader">{entry[0].column}</span>
          {#each entry as sign (sign.id)}
            <div class="cell" role="cell" title={`mixocr ${sign.mixocr || '—'} · band ${sign.band || '—'}`}>
              <span class="glyph ui-script" lang="txg">{sign.char}</span>
              <span class="dots" aria-hidden="true">
                <i class:on={sign.mixocr === sign.char}></i>
                <i class:on={sign.band === sign.char}></i>
              </span>
              <span class="ui-visually-hidden">
                {sign.char}: mixocr {sign.mixocr === sign.char ? 'right' : 'wrong'};
                band reader {sign.band === sign.char ? 'right' : 'wrong'}
              </span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
    <p class="legend"><span><i class="dot on"></i>mixocr</span><span><i class="dot on"></i>band reader</span>
      <span class="ui-hint">Column numbers count from the right edge.</span></p>

    <p class="note aside-note">On five 夏漢字典 pages, a route over four general engines — OvisOCR3, Unlimited-OCR-2,
      GLM-OCR and PaddleOCR-VL 1.6 — wrote a Han character at 738 of 821 Tangut positions, and no
      engine wrote a Tangut code point (measured 2026-11-07). That test used different pages and is
      not in the table.</p>
  </section>

  <section class="ui-section">
    <div class="section-head">
      <h2>Reported</h2>
      <span class="ui-count">{ATTEMPTS.length} attempts</span>
    </div>
    <p class="note">Newest last. The sets differ in task, script and size; the figures are not a ranking.</p>

    <ol class="attempts">
      {#each ATTEMPTS as attempt (attempt.year + attempt.name)}
        <li class="attempt">
          <span class="year ui-mono">{attempt.year}</span>
          <div class="body">
            <p class="name">
              <a href={attempt.url} target="_blank" rel="noreferrer">{attempt.name}</a>
              {#each tags(attempt) as tag (tag)}<span class="tag">{tag}</span>{/each}
            </p>
            <p class="by">{attempt.by}</p>
            <p class="method"><span class="scope">{attempt.scope}</span> · {attempt.method}</p>
          </div>
          <div class="score">
            {#if attempt.score}<b>{attempt.score}</b>{:else}<b class="none">—</b>{/if}
            <span>{attempt.scoreNote}</span>
          </div>
          <div class="terms">{attempt.terms}</div>
        </li>
      {/each}
    </ol>
  </section>

  <section class="ui-section">
    <h2>What the sample is</h2>
    <p class="prose">The 24 answers are keyed by eye from the print and kept in
      <a href="https://github.com/mkpoli/tangut-input/blob/main/data/readings/cells/c40b1.tsv">c40b1.tsv</a>.
      The scan is the National Institute of Japanese Literature's 貽安堂 print
      (<a href="https://kokusho.nijl.ac.jp/biblio/100354804">DOI 10.20730/100354804</a>, CC BY-NC 4.0);
      the crop is not served here. A model trained on these answers would score 24/24 and prove nothing.</p>
    <p class="prose">Run and score a submission with the
      <a href="https://github.com/mkpoli/tangut-input/tree/main/benchmark/ocr">benchmark/ocr</a> runner.</p>
    <pre class="command"><code>bun benchmark/ocr/score.mjs predictions.jsonl</code></pre>
  </section>

  <footer class="foot ui-hint">
    Checked {LAST_CHECKED}. Reported figures are as published; where an abstract gives no single figure,
    the score reads —. Not a census: a project with no public trace is missing.
  </footer>
</article>

<style>
  .ocr{gap:var(--ui-space-3xl);padding-bottom:var(--ui-space-5xl)}
  .section-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--ui-space-md);padding-bottom:var(--ui-space-xs);border-bottom:1px solid var(--ui-color-border)}
  .section-head h2{font-family:var(--ui-font-serif);font-size:var(--ui-text-xl);font-weight:var(--ui-weight-semibold);line-height:1.25}
  .note{margin:0;max-inline-size:72ch;color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm);line-height:1.65}
  .note a,.prose a{color:var(--ui-color-accent-ink);text-underline-offset:2px}
  .aside-note{padding-top:var(--ui-space-sm);border-top:1px solid var(--ui-color-border);max-inline-size:66ch}

  .runs{display:grid;gap:1px;background:var(--ui-color-border);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);overflow:hidden}
  .run{display:grid;grid-template-columns:minmax(0,19rem) minmax(0,1fr) 4rem 4rem;align-items:center;gap:var(--ui-space-md);padding:var(--ui-space-sm) var(--ui-space-md);background:var(--ui-color-surface)}
  .run.ours{background:var(--ui-color-accent-soft)}
  .run-name{display:grid;gap:2px;min-inline-size:0}
  .run-name b{font-family:var(--ui-font-serif);font-size:var(--ui-text-md);font-weight:var(--ui-weight-semibold)}
  .run-name span{color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);line-height:1.4}
  .bar{block-size:6px;border-radius:999px;background:var(--ui-color-surface-sunken);overflow:hidden}
  .bar i{display:block;block-size:100%;inline-size:calc(var(--v) * 100%);background:var(--ui-color-ink);border-radius:inherit}
  .run.ours .bar i{background:var(--ui-color-accent)}
  .right,.pct{font-family:var(--ui-font-mono);font-size:var(--ui-text-sm);font-variant-numeric:tabular-nums;text-align:end}
  .pct{color:var(--ui-color-ink-muted)}

  .matrix{display:grid;gap:1px;background:var(--ui-color-border);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);overflow:hidden}
  .row{display:grid;grid-template-columns:2.25rem repeat(4,minmax(0,1fr));gap:1px;background:var(--ui-color-border)}
  .column{display:grid;place-items:center;background:var(--ui-color-surface-sunken);color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  .cell{display:grid;place-items:center;gap:5px;padding:10px 4px 9px;background:var(--ui-color-surface)}
  .glyph{font-size:30px;line-height:1.05}
  .dots{display:flex;gap:5px}
  .dot,.dots i{inline-size:5px;block-size:5px;border-radius:50%;border:1px solid var(--ui-color-ink-muted);background:transparent}
  .dots i.on,.dot.on{background:var(--ui-color-accent);border-color:var(--ui-color-accent)}
  .legend{display:flex;align-items:center;flex-wrap:wrap;gap:var(--ui-space-sm);margin:0;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .legend span{display:inline-flex;align-items:center;gap:6px}
  .legend .ui-hint{margin-inline-start:auto}

  .attempts{display:grid;margin:0;padding:0;list-style:none;border-top:1px solid var(--ui-color-border)}
  .attempt{display:grid;grid-template-columns:4rem minmax(0,1fr) 9.5rem 9.5rem;gap:var(--ui-space-lg);align-items:start;padding:var(--ui-space-lg) 0;border-bottom:1px solid var(--ui-color-border)}
  .year{padding-top:3px;color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs)}
  .body{display:grid;gap:3px;min-inline-size:0}
  .name{display:flex;align-items:baseline;flex-wrap:wrap;gap:var(--ui-space-2xs);margin:0;font-family:var(--ui-font-serif);font-size:var(--ui-text-lg);line-height:1.3}
  .name a{color:var(--ui-color-ink);text-underline-offset:3px;text-decoration-color:var(--ui-color-border-strong)}
  .name a:hover{color:var(--ui-color-accent-ink);text-decoration-color:currentColor}
  .tag{padding:1px 5px;border:1px solid var(--ui-color-border-strong);border-radius:4px;color:var(--ui-color-ink-muted);font-family:var(--ui-font-mono);font-size:10px;font-weight:400;line-height:1.4;text-transform:uppercase;letter-spacing:0.04em}
  .by{margin:0;color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm);line-height:1.45}
  .method{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);line-height:1.5}
  .scope{color:var(--ui-color-ink-soft);font-weight:600}
  .score{display:grid;gap:2px;text-align:end}
  .score b{font-family:var(--ui-font-serif);font-size:var(--ui-text-lg);font-weight:var(--ui-weight-semibold);line-height:1.2;font-variant-numeric:tabular-nums}
  .score b.none{color:var(--ui-color-ink-muted);font-weight:400}
  .score span{color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);line-height:1.4}
  .terms{color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);line-height:1.5;text-align:end}

  code{padding:0.1em 0.35em;border-radius:4px;background:var(--ui-color-surface-sunken);font-family:var(--ui-font-mono);font-size:0.9em}
  .command{margin:0;padding:var(--ui-space-sm) var(--ui-space-md);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken);overflow-x:auto}
  .command code{padding:0;background:none;font-size:var(--ui-text-xs)}
  .prose{margin:0;max-inline-size:68ch;color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm);line-height:1.7}
  .foot{border-top:1px solid var(--ui-color-border);padding-top:var(--ui-space-md)}

  @media (max-width:860px){
    .attempt{grid-template-columns:3rem minmax(0,1fr) 8rem;gap:var(--ui-space-md)}
    .terms{grid-column:2 / -1;text-align:start;padding-top:2px}
    .score{text-align:end}
  }
  @media (max-width:600px){
    .run{grid-template-columns:minmax(0,1fr) 3.5rem 3.5rem;gap:var(--ui-space-sm)}
    .bar{display:none}
    .run-name{grid-column:1 / -1}
    .attempt{grid-template-columns:2.5rem minmax(0,1fr);gap:var(--ui-space-sm)}
    .score{grid-column:2;display:flex;align-items:baseline;gap:var(--ui-space-sm);text-align:start}
    .score b{font-size:var(--ui-text-md)}
    .terms{grid-column:2;text-align:start}
    .legend .ui-hint{margin-inline-start:0}
    .glyph{font-size:26px}
  }
</style>
