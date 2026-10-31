# Tangut Input

A Tangut-only editor for ideographic description sequences. Build a description from Tangut
components, see its tree and drawing, read the character's glosses and export it as SVG or PNG.

The app is a static site. It runs locally with:

```sh
bun install
bun run dev
```

## Current capabilities

- Tangut component palette, 768 components in code point order.
- IDS input, operators, tree editing and part replacement.
- Local Tangut outlines from Noto Serif Tangut; no Han export is needed for a pure Tangut description.
- Glosses and related characters from Wiktionary's Tangut entries.
- Drawing search over the Tangut component shapes.
- SVG and PNG export.

OCR, an IME and corpus attestation are later additions.

## Sources

- [BabelStone Tangut IDS](https://www.babelstone.co.uk/Tangut/TangutIDS.txt), Andrew West. Public
  domain. The filtered table is `data/tangut-ids.tsv.gz`.
- [Noto Serif Tangut](https://github.com/notofonts/noto-fonts/tree/main/unhinted/ttf/NotoSerifTangut),
  Google. SIL OFL 1.1. Outlines in `data/tangut-outlines.json.gz`, font in `fonts/`.
- [Wiktionary Tangut entries](https://kaikki.org/dictionary/Tangut/) via Wiktextract. CC BY-SA 4.0.
  The source JSONL is `data/tangut-glosses-en-source.jsonl.gz`; the panel data is
  `data/character-info.json.gz`.
- [Unicode TangutSources.txt](https://www.unicode.org/Public/UCD/latest/ucd/TangutSources.txt).
  Unicode License v3. Stroke counts and radical data.
- Tangut layer data and component stroke counts are derived from the BabelStone table and the
  bundled Noto Serif Tangut outlines.

The added code is MIT; see `LICENSE`.
