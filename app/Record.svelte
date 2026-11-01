<script>
  // One character's record: its number, description, readings, meanings and where it attested,
  // followed by the editor that builds its description from parts.
  import { app } from './store.svelte.js'
  import Editor from './Editor.svelte'
  import Attestation from './Attestation.svelte'

  /** @type {{ char: string }} */
  let { char } = $props()
  const entry = $derived(app.data.byChar.get(char))
  const codes = $derived(app.data.codes.get(char) ?? [])
  const readings = $derived(Object.entries(entry?.pronunciations ?? {}).filter(([, value]) => value))
  const NAMES = /** @type {Record<string, string>} */ ({
    li_fanwen: 'Li Fanwen 2008', miyake: 'Miyake', kychanov: 'Kychanov 2006', sofronov: 'Sofronov 1968',
    nishida: 'Nishida 1966', gong_huangcheng: 'Gong Hwang-cherng', gong_xun_202411: 'Gong Xun 2024-11',
    arakawa_shintaro: 'Arakawa Shintarō', sound_li_fanwen: 'Li Fanwen sound gloss', sound_nie_lishan: 'Nie Lishan sound gloss',
  })
</script>

<section class="record" aria-label="Character record">
  <div class="head">
    <span class="glyph" lang="txg">{char}</span>
    <div class="meta">
      <p class="point">{entry?.codepoint ?? char.codePointAt(0)?.toString(16).toUpperCase()}</p>
      {#if entry?.total_strokes}<p>{entry.total_strokes} strokes{#if entry.radical} · radical <span lang="txg">{entry.radical}</span>{#if entry.radical_extra_strokes !== undefined} + {entry.radical_extra_strokes}{/if}{/if}</p>{/if}
      {#if codes.length}<p class="codes">Cangjie {codes.map(code => code.toUpperCase()).join(' · ')}</p>{/if}
    </div>
  </div>

  {#if entry?.definitions?.en?.length || entry?.definitions?.zh?.length || entry?.definitions?.ja?.length}
    <dl class="glosses">
      {#if entry.definitions.en?.length}<dt>English</dt><dd>{entry.definitions.en.join('; ')}</dd>{/if}
      {#if entry.definitions.ja?.length}<dt lang="ja">日本語</dt><dd lang="ja">{entry.definitions.ja.join(' ') }</dd>{/if}
      {#if entry.definitions.zh?.length}<dt lang="zh">中文</dt><dd lang="zh">{entry.definitions.zh.join('；')}</dd>{/if}
    </dl>
  {/if}

  {#if readings.length}
    <h2>Readings</h2>
    <dl class="readings">
      {#each readings as [key, value] (key)}
        <dt>{NAMES[key] ?? key}</dt><dd>{value}</dd>
      {/each}
    </dl>
  {/if}

  {#if entry?.wenhai_text_en || entry?.wenhai_text_zh}
    <h2>Wenhǎi gloss</h2>
    {#if entry.wenhai_text_en}<p>{entry.wenhai_text_en}</p>{/if}
    {#if entry.wenhai_text_zh}<p lang="zh">{entry.wenhai_text_zh}</p>{/if}
  {/if}

  <Editor {char} composition={entry?.composition ?? ''} />
  <Attestation {char} />
</section>

<style>
  .record{padding:20px;overflow:auto;min-width:0}
  .head{display:flex;align-items:center;gap:16px}
  .glyph{font-family:var(--tangut);font-size:84px;line-height:1;border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:10px 16px}
  .meta p{margin:2px 0;color:var(--muted);font-size:13px}
  .meta .point{color:var(--ink);font-weight:600}
  .meta .codes{font-family:ui-monospace,monospace}
  h2{margin:18px 0 6px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
  dl{margin:0;display:grid;grid-template-columns:max-content 1fr;gap:2px 12px}
  dt{color:var(--muted);font-size:12.5px}
  dd{margin:0}
  p{margin:6px 0}
</style>
