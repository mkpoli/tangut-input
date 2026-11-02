<script>
  // Where every record on the site comes from, and how each finder treats it.
  import { db } from '../lib/db.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  const corpus = $derived(db.attestation?.corpus)
</script>

<article class="about">
  <h1>{t('nav.sources')}</h1>
  <p class="lead">{t('about.lead')}</p>

  <section>
    <h2>{t('about.records')}</h2>
    <dl>
      <dt>{t('about.recordsTitle')}</dt>
      <dd><a href="https://github.com/imlooh/open-tangut">Open Tangut</a> by imlooh (MIT), a dictionary of the Tangut block in English, Japanese and Chinese scraped from CCAMC and Wiktionary. 6,144 entries, each with readings in Li Fanwen 2008, Gong Hwang-cherng, Gong Xun 2024-11, Arakawa Shintarō, Miyake, Nishida 1966, Kychanov 2006 and Sofronov 1968, and sound glosses after Li Fanwen and Nie Lishan. The 文海 gloss is present for few entries.</dd>
      <dt>{t('about.cangjieTitle')}</dt>
      <dd><a href="https://github.com/Hulenkius/rime_tangutcjkk">rime_tangutcjkk</a> by Hulenkius, the Tangut Cangjie scheme of Kawasaki Keigo (2016) for RIME: 11,805 full and short codes, components under codes beginning <span class="mono">p</span>. The table itself warns that some characters are wrongly encoded, and the repository states no licence. Tutorial and practice tables: <a href="https://tlistlil.github.io/sps/Tang/cj/">tlistlil.github.io/sps/Tang/cj</a>.</dd>
      <dt>{t('about.strokesTitle')}</dt>
      <dd>Ideographs from Unicode’s <a href="https://www.unicode.org/Public/18.0.0/ucd/TangutSources.txt">TangutSources.txt</a> (Unicode 18.0); components counted from their glyphs in this project’s review.</dd>
      <dt>{t('about.attestTitle')}</dt>
      <dd>Kirill Solonin and Shintaro Arakawa, <a href="https://hdl.handle.net/10108/0002000647"><i>Śāntideva’s Bodhicaryāvatāra in Tangut Translation</i></a>, vol. 1 (ILCAA, TUFS, 2024), CC BY 4.0: chapter 2, the manuscript IOM RAS Tangut no. 781, with the edition’s English translation and facsimile. The facsimile reproduces photographs by the Institute of Ethnology, CASS. Line readings: ぶんぽ, <a href="https://note.com/bunpo10381227">西夏語公開自主ゼミ</a> (note.com, 2024-12-30 to 2025-09-15), linked line by line and not reproduced. Lines, character boxes and crops recorded by Glyph Atlas.
        {#if corpus}So far: {corpus.lines} lines, {corpus.characters} characters, {corpus.distinct} distinct.{/if}</dd>
      <dt>{t('about.glyphsTitle')}</dt>
      <dd>Noto Serif Tangut (SIL OFL 1.1), from Google Fonts. The drawing pad’s glyph masks are rendered from the same font.</dd>
    </dl>
  </section>

  <section>
    <h2>{t('about.how')}</h2>
    <dl>
      <dt>{t('nav.cangjie')}</dt>
      <dd>A typed code lists every character whose full or short code begins with it: an exact code first, then shorter codes. Wrong codes in the table are found as the table has them.</dd>
      <dt>{t('nav.reading')}</dt>
      <dd>Readings in all eight systems are folded to plain letters: diacritics dropped, IPA letters replaced by the nearest Latin letter (<span class="mono">ɨ ɪ → i</span>, <span class="mono">ə → e</span>, <span class="mono">ŋ → ng</span>), separators removed. A final digit is the tone. Near matches also ignore medial <span class="mono">j</span> and <span class="mono">y</span> and a prenasal before a stop.</dd>
      <dt>{t('nav.draw')}</dt>
      <dd>The drawing and each glyph are stretched into the same 32-pixel square, the glyph reduced to a one-cell line along its pen, and compared by how far each line lies from the other’s and by the direction the ink runs at each point. Stroke order plays no part. On eighty characters drawn by one reader, the right character came first about three times in ten and within the first five about one time in two.</dd>
      <dt>{t('nav.parts')}</dt>
      <dd>A character matches when its description holds every chosen part, as often as chosen. Descriptions are Open Tangut’s and use components only.</dd>
      <dt>{t('attest.title')}</dt>
      <dd>A character outside the corpus has no attestation <em>yet</em>: the corpus is one chapter, and absence says nothing about the character.</dd>
    </dl>
  </section>

  <section>
    <h2>{t('about.mark')}</h2>
    <p><span class="tg">𘅤</span> (U+18164), glossed “to write” in Open Tangut, read <i>rjar¹</i> by Li Fanwen.</p>
  </section>

  <section>
    <h2>What is kept</h2>
    <p class="lead">Every drawing made on the Draw page and every character picked from a finder is
    recorded with the finder it came from, the character chosen and the place it stood in the list.
    A drawing kept with a pick is one example the search could be measured or trained on. A record
    carries a random id that lives in your browser, never your address, and there is no account.
    The quiz saves the same fields for each round, with the prompt it asked for.</p>
  </section>

  <p class="muted small">{t('about.code')} <a href="https://github.com/mkpoli/tangut-input">github.com/mkpoli/tangut-input</a>.</p>
</article>

<style>
  .about{max-width:760px;display:grid;gap:22px;padding-bottom:40px}
  h1{font-family:var(--serif);font-size:30px;font-weight:600}
  h2{font-family:var(--serif);font-size:19px;margin-bottom:8px}
  .lead{font-size:15px;color:var(--ink-2)}
  dl{display:grid;gap:12px;margin:0}
  dt{font-weight:600;font-size:13.5px}
  dd{margin:2px 0 0;font-size:14px;line-height:1.6;color:var(--ink-2)}
  .tg{font-size:22px;vertical-align:-3px}
  .small{font-size:12.5px}
</style>
