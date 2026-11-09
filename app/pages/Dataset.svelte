<script>
  /**
   * The drawings as a dataset: how many, in what shape, from whose hands, and where to get the files.
   * The files themselves are static beside this page under /dataset/.
   */
  import { counts } from '../lib/dataset-counts.js'
  import { leaderboard } from '../lib/leaderboard.js'

  /** @type {{ name: string, top1: number, top5: number, top24: number, mrr: number }[]} */
  const entries = Object.entries(leaderboard)
    .map(([name, result]) => ({ name, ...result }))
    .sort((a, b) => b.top1 - a.top1)

  const example = `{"id": "2026-11-01T14-42-08/001", "char": "𗀀", "kind": "glyph", "label": "answer",
 "strokes": [[[0.13, 0.44], [0.51, 0.4]], …],
 "times": […], "pressure": […], "width": 340, "height": 340}`
</script>

<section class="dataset">
  <header>
    <h1>Tangut stroke dataset</h1>
    <p class="lead">Strokes drawn on this site's pad with a mouse, a trackpad or a stylus, kept with the
      character each one was made for.</p>
    <p class="counts">
        <span>{counts.drawings} drawings</span>
        <span>{counts.chars} characters</span>
        <span>{counts.sessions} rounds</span>
        <span>{counts.reviewed} reviewed</span>
        <span>{counts.corrected} corrected</span>
    </p>
  </header>

  <h2>Files</h2>
  <ul class="files">
    <li><a href="/dataset/tangut-strokes.jsonl.gz">tangut-strokes.jsonl.gz</a> — one JSON record per line, gzipped</li>
    <li><a href="/dataset/annotations.json">annotations.json</a> — a reader's verdict on each reviewed drawing, and the character it should have been</li>
    <li><a href="/dataset/manifest.json">manifest.json</a> — schema version, counts, and the faces the printed shapes come from</li>
    <li><a href="/dataset/gallery.html">gallery.html</a> — every drawing beside the character it was made for</li>
  </ul>

  <h2>What this is</h2>
  <p>Input for a search box: rough shapes a reader can produce in a few seconds to find a character they
    cannot type. The pad records the path of the pointer and nothing else.</p>
  <table class="scope">
    <tbody>
      <tr><th>Input</th><td>mouse, trackpad or stylus, in a browser</td></tr>
      <tr><th>Line</th><td>one width per drawing, whatever the speed or the pressure</td></tr>
      <tr><th>Writers</th><td>visitors to the site, with no knowledge of the script required</td></tr>
      <tr><th>Order</th><td>the order the strokes were drawn, which is not always the order a scribe writes them</td></tr>
      <tr><th>Use</th><td>training and testing character recognition for search</td></tr>
    </tbody>
  </table>

  <h2>A record</h2>
  <pre><code>{example}</code></pre>
  <p class="note">Strokes are polylines in the unit square, in the order they were drawn. <code>times</code>
    records when each point was sampled; <code>pressure</code> is kept where the browser reported one, and on a
    mouse it is absent. <code>label</code> reads <code>answer</code>
    where the character was shown to the writer, and <code>picked</code> where it is only what a reader chose from
    the search results.</p>

  <h2>Whose hands</h2>
  <table>
    <thead><tr><th>Hand</th><th>Character</th></tr></thead>
    <tbody>
      <tr><td>Quiz rounds</td><td>shown to the writer before drawing</td></tr>
      <tr><td>Live pad</td><td>picked from the results after drawing</td></tr>
      <tr><td>Reviewer</td><td>drawn to point at the character another drawing should have been</td></tr>
    </tbody>
  </table>

  <h2>Benchmark</h2>
  <p>A fixed split, a scorer and a baseline. Rank up to 24 characters per drawing and score it:
    <code>bun benchmark/score.mjs --name you submissions/you.jsonl</code>.</p>
  <table class="board">
    <thead><tr><th>Entry</th><th>First</th><th>In five</th><th>In 24</th><th>MRR</th></tr></thead>
    <tbody>
      {#each entries as entry (entry.name)}
        <tr><th>{entry.name}</th><td>{(entry.top1 * 100).toFixed(1)}%</td><td>{(entry.top5 * 100).toFixed(1)}%</td>
          <td>{(entry.top24 * 100).toFixed(1)}%</td><td>{entry.mrr.toFixed(3)}</td></tr>
      {/each}
    </tbody>
  </table>
  <p class="note">Protocol and submission format:
    <a href="https://github.com/mkpoli/tangut-input/blob/main/benchmark/README.md">benchmark/README.md</a>.</p>

  <h2>Where else it lives</h2>
  <ul class="files">
    <li><a href="https://huggingface.co/datasets/mkpoli/tangut-strokes">Hugging Face</a> — the records, the split and the baseline, loadable with <code>load_dataset</code></li>
    <li><a href="https://www.kaggle.com/datasets/mkpoli/tangut-strokes">Kaggle</a> — the same files, with notebooks beside them</li>
  </ul>

  <h2>Licence</h2>
  <p>The drawings are released under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Cite
    “Tangut stroke dataset, tangut.mkpo.li” with the date you downloaded it. The printed characters are not
    part of this release; they belong to the typefaces the site draws with, each under its own licence, listed in
    <a href="/about">Sources</a>.</p>

  <p class="note">Try the <a href="/draw">pad</a> · <a href="/dataset/gallery.html">all drawings</a> ·
    <a href="https://github.com/mkpoli/tangut-input/blob/main/docs/handwriting.md">how the corpus is kept</a></p>
</section>

<style>
  .dataset{max-inline-size:44rem;padding:var(--ui-space-xl) var(--ui-space-lg) var(--ui-space-2xl)}
  h1{font-size:1.9rem;font-weight:500;letter-spacing:-0.01em;margin:0 0 var(--ui-space-xs)}
  .lead{color:var(--ui-color-ink-soft);margin:0 0 var(--ui-space-sm);max-inline-size:36em}
  .counts{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs) var(--ui-space-md);font:500 0.8125rem/1.4 var(--ui-font-mono);color:var(--ui-color-ink-soft);margin:0 0 var(--ui-space-lg)}
  h2{font:500 0.6875rem/1.4 var(--ui-font-mono);text-transform:uppercase;letter-spacing:0.1em;color:var(--ui-color-ink-soft);margin:var(--ui-space-lg) 0 var(--ui-space-2xs)}
  ul.files{margin:0;padding-inline-start:1.1em}
  ul.files li{margin-block:0.25em}
  pre{margin:0 0 var(--ui-space-2xs);padding:var(--ui-space-sm);background:var(--ui-color-surface-sunken);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);overflow-x:auto}
  pre code{font:0.8125rem/1.55 var(--ui-font-mono)}
  code{font:0.875em/1.4 var(--ui-font-mono);background:color-mix(in srgb,var(--ui-color-ink) 6%,transparent);padding:0.05em 0.3em;border-radius:4px}
  pre code{background:none;padding:0}
  table{border-collapse:collapse;margin:0 0 var(--ui-space-xs);font-size:0.9375rem}
  th,td{text-align:start;padding:0.35em var(--ui-space-md) 0.35em 0;border-block-end:1px solid var(--ui-color-border)}
  th{font-weight:500;color:var(--ui-color-ink-soft);font-size:0.8125rem}
  .note{font-size:0.9375rem;color:var(--ui-color-ink-soft)}
  a{color:var(--ui-color-accent)}
</style>
