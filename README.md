# Tangut Input

A site for entering Tangut: name a character in whatever form you have, check its record, and put
it into your text. <https://tangut.mkpo.li/>

## Finding a character

- **Find**: one box for anything. Pasted Tangut is listed character by character with meanings and
  readings; Latin letters are tried as a Cangjie code, a reading and a meaning at once; `U+17…`
  lists code points.
- **Cangjie**: an input method over the Tangut Cangjie codes. Candidates are numbered; `Space` or a
  digit adds one to the text. The on-screen keyboard shows the shapes each key names and dims the
  keys no code continues with. Every component is listed under its own code (beginning `p`).
- **Reading**: a reconstruction in any of eight systems (Li Fanwen, Gong Hwang-cherng, Gong Xun,
  Arakawa, Miyake, Nishida, Kychanov, Sofronov), with or without diacritics, with an optional tone.
- **Draw**: a drawing pad ranked by glyph shape against Noto Serif Tangut. It is rough, and the
  page says how rough.
- **Parts**: choose components; each choice narrows the characters and the remaining parts.

The card of a character shows its code point, Cangjie codes, meanings in English, Japanese and
Chinese, readings, structure, the lines of the recorded corpus where it stands with the scribe's
form from the facsimile, and related characters. The text being written stays in the browser and
copies as text, code points or Cangjie codes.

The design and its reasoning are in [`docs/design.md`](docs/design.md).

## Data

- `app/data/tangut-entries.json.gz`: meanings and readings, from [Open
  Tangut](https://github.com/imlooh/open-tangut) (MIT), which merges CCAMC and Wiktionary entries.
- `app/data/tangut-cangjie.json.gz`: Cangjie codes, from
  [rime_tangutcjkk](https://github.com/Hulenkius/rime_tangutcjkk) by Hulenkius, after the scheme of
  Kawasaki Keigo (2016). The table warns that some characters are wrongly encoded; the repository
  states no licence.
- `app/data/tangut-strokes.json.gz`: stroke counts, ideographs from Unicode's TangutSources.txt,
  components counted from their glyphs (copied from `data2/`).
- `app/data/tangut-attestation.json.gz` and `app/public/facsimile/`: lines of the corpus and the
  characters cut from the facsimile, built from the Glyph Atlas record of Solonin and Arakawa's
  *Bodhicaryāvatāra in Tangut Translation*, chapter 2 (CC BY 4.0), with links to ぶんぽ's line
  readings, by `scripts/build_tangut_attestation.py`.
- `app/data/tangut-shapes.bin.gz`: glyph masks for the drawing pad, rendered from Noto Serif Tangut
  2.168 by `scripts/build_tangut_shapes.py`; `scripts/eval_tangut_shapes.mjs` measures the search.

## Faces

The Tangut script can be set in three faces from the switch at the right of the top bar: Noto Serif
Tangut (the default, from Google Fonts), Tangut Yinchuan (景永時's design, completed by Andrew West)
and BabelStone Tangut Wenhai. Yinchuan and the Wenhai complement are served from the site; their
terms are in `app/public/fonts/FONT-LICENCES.md`. `bun run build:tangut-fonts` rebuilds the two
small subsets.

## Handwriting data

`bun run quiz` serves a local quiz on <http://127.0.0.1:5411/>: it shows one Tangut character to
copy, or two to four characters that look alike to choose between and draw, and saves each answer's
strokes beside the prompt it answered in `data/handwriting/<timestamp>/`. Pass `--size`, `--seed`,
`--port` and `--out` to change the round. The strokes are normalised to the pad's width, so they can
be compared with a drawing made on the site's Draw page.

## Development

```sh
bun install
bun run dev                    # the site
bun run check                  # types and Svelte checks
bun run build:app              # the static site into dist/
bun scripts/shoot_app.mjs      # screenshots of dist/ into docs/design/
```

The glyphs are set in Noto Serif Tangut from Google Fonts, with a small subset of the bundled
version for the components Google's build lacks (`app/public/fonts/`, SIL OFL 1.1).

The added code is MIT; see `LICENSE`.
