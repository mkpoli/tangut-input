# Tangut Input

A site for entering Tangut: name a character in whatever form you have, check its record, and put
it into your text. <https://tangut.mkpo.li/>

## Finding a character

- **Find**: one box for anything. Pasted Tangut is listed character by character with meanings and
  readings; Latin letters are tried as a Cangjie code, a reading and a meaning at once; `U+17…`
  lists code points. Tangut components also answer to their Japanese shape names, such as くノ,
  ノメ or くくノ. A description is read against the records' own: `⿰𘤊𘠡` names 𗾇, and cut after its
  opening part it lists the characters that open that way.
- **Texts**: every text behind the corpus, grouped by edition, Wikisource, the Lausanne Corpus and
  MiCA, with its passages, characters, source and first line. Read opens the text passage by
  passage, where each character opens its card; Transcribe still loads the first line.
- **Cangjie**: an input method over the Tangut Cangjie codes. Candidates are numbered; `Space` or a
  digit adds one to the text. The on-screen keyboard shows the shapes each key names and dims the
  keys no code continues with. Every component is listed under its own code (beginning `p`).
- **Reading**: a reconstruction in any of the seven systems the site shows (Li Fanwen, Gong
  Hwang-cherng, Gong Xun 2024-11, Miyake, Nishida, Kychanov, Sofronov), with or without diacritics,
  with an optional tone. One further system that CCAMC records also answers the search; those
  results link to CCAMC.
- **Fanqie**: type the two characters a rhyme book spells a character with, or pick each from a
  compact panel beside the field that offers Find, Meaning, Cangjie, Four-corner, Reading, Draw and
  Parts in miniature.
- **Draw**: a drawing pad ranked by glyph shape against bundled Tangut faces. Choose parts to
  narrow the candidates.
- **Parts**: choose parts, components or character-sized, from the palette or by drawing them;
  each choice narrows the characters and the remaining parts. The filter takes a Cangjie code or a Japanese shape name, and hovering a
  part shows its code point, component number, strokes, uses, Cangjie codes and name. A collapsible
  table compares the names across the languages that record one.

The card of a character shows its code point, Cangjie codes, meanings in English and Japanese,
readings, the 對音 it carries (the Chinese character the 掌中珠 transcribes it with, and any
Tibetan gloss), structure, the lines of the recorded corpus where it stands with the scribe's form from
the facsimile, and related characters. The 文海's own entry text is shown where it carries one;
further readings and meanings are linked to CCAMC's page for the character rather than copied.
Character tiles carry a reconstruction above the glyph — the one chosen at the top bar, or the one
a reading search matched — with the finder's own note below it. The text being written stays in the
browser and copies as text, code points or Cangjie codes.

The design and its reasoning are in [`docs/design.md`](docs/design.md).

## Data

- `app/data/tangut-entries.json.gz`: five readings and English and Japanese meanings from
  [Wiktionary](https://en.wiktionary.org/wiki/Module:txg/data) (CC BY-SA 4.0), Gong Hwang-cherng's
  and Gong Xun's readings from the
  [Tangut Pronunciation Database](https://github.com/semakosa/tangut-pronunciation-db),
  descriptions from BabelStone's Tangut IDS, and the 文海's own entry text where it carries one;
  built by `scripts/build_tangut_entries.py` from `data/wiktionary/`, `data/gong-xun/` and
  `data/wenhai/`.
- `app/data/tangut-ccamc-index.json.gz`: normalized terms from CCAMC's records, used only to answer
  the reading and meaning searches. No page renders them; the card links to CCAMC.
- `app/data/tangut-zzz.json.gz`: the Chinese character 《番漢合時掌中珠》 transcribes each Tangut
  character with, and the entry it stands in; built by `scripts/build_tangut_zzz.mjs` from the
  keyed columns of the NIJL scan. Empty until the keying reaches the Tangut headwords.
- `app/data/tangut-tibetan.json`: Tibetan phonetic glosses of 197 characters in five British
  Library manuscripts, from [BabelStone](https://www.babelstone.co.uk/Tangut/TangutTibetanIndex.html).
- `app/data/tangut-cangjie.json.gz`: Cangjie codes, from
  [rime_tangutcjkk](https://github.com/Hulenkius/rime_tangutcjkk) by Hulenkius, after the scheme of
  Kawasaki Keigo (2016). The table warns that some characters are wrongly encoded; the repository
  states no licence.
- `app/data/tangut-strokes.json.gz`: stroke counts, ideographs from Unicode's TangutSources.txt,
  components counted from their glyphs (copied from `data2/`).
- `app/data/tangut-supplement.json.gz`: the 33 ideographs and 115 components Unicode 18.0.0 assigns in
  Tangut Supplement and Tangut Components Supplement, with their Unicode names, strokes,
  descriptions (BabelStone for U+18D00–U+18D08, the WG2 proposals for U+18D09–U+18D20), Cangjie codes and
  the face that draws each; built by `scripts/build_tangut_supplement.py`.
- `app/data/tangut-attestation.json.gz` and `app/public/facsimile/`: where each character stands in
  fourteen sources, built by `scripts/build_tangut_attestation.py`. One is the Glyph Atlas record of
  Solonin and Arakawa's *Bodhicaryāvatāra in Tangut Translation*, chapter 2 (CC BY 4.0), with its
  facsimile crops, English translation and links to ぶんぽ's line readings. Twelve are on Wikisource
  (CC BY-SA 4.0): five Buddhist texts, the three poems, the Liangzhou stele, the Forest of
  Categories, the Precious Dual Maxims and the Tongyin preface. The last is the Lausanne Corpus of
  Digital Tangut Texts, 21 texts used with permission; see `data/lcdtt/README.md`.
  `data/wikisource/pages.json` pins the Wikisource revisions; refresh it with
  `python3 scripts/fetch_tangut_wikisource.py`.
- `app/data/tangut-samples.json`: eighteen passages copied from the corpus, thirteen marked famous,
  offered by the Samples button in the text strip and on Transcribe; built by
  `scripts/build_tangut_samples.py` from the attestation file.
- `app/data/tangut-frequency.json.gz`: how often each character occurs in the corpus, built by
  `scripts/build_tangut_frequency.py`; the finders put the commoner characters first within each
  tier.
- `app/data/tangut-shapes.bin.gz`: glyph pen lines for the drawing pad, rendered from Noto Serif
  Tangut 2.168 by `scripts/build_tangut_shapes.py`; `scripts/handwriting/score.mjs` measures the
  search on drawings made by hand and `scripts/eval_tangut_shapes.mjs` on drawings made from a font.

## Faces

The Tangut script can be set in four faces in Settings: Noto Serif
Tangut (the default, from Google Fonts), Tangut Yinchuan (景永時's design, completed by Andrew West),
BabelStone Tangut Wenhai, and New Tangut Std (新西夏字體, the 楷書-structured face). Yinchuan and the Wenhai complement are served from the site; their
terms are in `app/public/fonts/FONT-LICENCES.md`. The ideographs and components of both supplement
blocks, which none of the four draws, come from a subset of Tangut N4694 in the same stack. `bun run build:tangut-fonts` rebuilds the small subsets.

## Handwriting data

`bun run quiz` serves a local quiz on <http://127.0.0.1:5411/>: it shows one Tangut character to
copy, or two to four characters that look alike to choose between and draw, and saves each answer's
strokes beside the prompt it answered in `data/handwriting/<timestamp>/`. Pass `--size`, `--seed`,
`--port` and `--out` to change the round. `bun run quiz:score <session-dir>` ranks every saved
drawing against all ideographs and reports where the answer came, so a change to the drawing search
can be judged on real strokes; add `--strokes 1` to count the stroke count too.

Each drawing is saved with what a recognizer needs: the strokes, the time of every point, the pen's
pressure, the pointer type, the browser, and the writer's name (kept in the browser, so drawings can
be split by hand). The strokes are normalised to the pad's width, so they can be compared with a
drawing made on the site's Draw page.

`bun run quiz:dataset` collects every saved drawing into `data/handwriting/dataset.jsonl.gz`, one
record per line with its session beside it, and `dataset.json` as a manifest. The quiz rebuilds both
after each saved drawing. The folder is ignored by git, so recordings stay on the machine that made
them; `docs/handwriting.md` describes the fields.

## Materials

`docs/materials.md` lists every source the site draws on — what each actually gives, the terms it
comes under, and what is still missing: 掌中珠's entries, 藏文對音 beyond five manuscripts,
and any seal or cursive forms.

## Records

The deployed site keeps what readers drew and picked in a D1 database: `drawings` holds a pad
drawing with the character chosen from its results, or a quiz round's prompt with the pen's timing
and pressure; `picks` holds a character chosen from any finder with the page and the query behind it.
A record carries a random id from the browser's local storage, no address and no account.
`POST /api/record` is the only thing the worker answers; every page is still served from the assets.

```sh
bun run records                      # counts, the last drawings and the last picks
bun run records --sql "select finder, count(*) from picks group by finder"
bunx wrangler d1 migrations apply tangut-records --remote   # the schema, once
```

## Development

```sh
bun install
bun run dev                    # the site
bun run check                  # types and Svelte checks
bun run check:design           # the design system and every page in Chromium
bun run build:app              # the static site into dist/
bun scripts/shoot_app.mjs      # screenshots of dist/ into docs/design/
```

The design system is in [`design/`](design/); its reference page is served at `/design.html` in
development and built beside the site. `bun run check:design` expects the dev server on
`http://localhost:5180`; set `DESIGN_URL` for another address.

## Deployment

A push to `main` builds the app and deploys it to Cloudflare through
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The workflow runs
`bun run verify`, builds `dist/`, and deploys that artifact with Wrangler. It needs
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets. A pull request runs the
same verification and build without deploying.

The glyphs are set in Noto Serif Tangut from Google Fonts, with a small subset of the bundled
version for the components Google's build lacks (`app/public/fonts/`, SIL OFL 1.1).

The added code is MIT; see `LICENSE`.

## Sponsor

I build tangut-input on my own, with no funding behind it, and it's free for everyone. If it's useful to you, a tip on [Ko-fi](https://ko-fi.com/mkpoli) or [OFUSE](https://ofuse.me/mkpoli) gives me time to keep improving it. Companies interested in sponsoring can write to mkpoli@mkpo.li.

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/mkpoli)
