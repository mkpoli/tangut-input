# Tangut Input

A site for naming a Tangut character and reading what is recorded about it.

## Naming a character

- **Cangjie**: type the Tangut Cangjie letters; the characters whose full or short code starts with
  them follow.
- **Reconstruction**: type a reading in any of the systems the records carry (Gong Hwang-cherng,
  Gong Xun, Li Fanwen, Miyake, Kychanov, Sofronov, Nishida, Arakawa). Tone marks and vowel diacritics
  are ignored.
- **Meaning**: type an English, Japanese or Chinese word from a character's meanings.
- **Component**: type a component; the characters whose description contains it follow.
- **Typed character**: type a Tangut character itself to open its record.

Handwriting and image recognition are not built yet. A drawing has no open model for Tangut; the
only published recognizer leaves out most of the script.

## The record

The chosen character shows its code point, stroke count and radical, its Cangjie codes, its meanings
in English, Japanese and Chinese, its readings in every recorded system, the 文海 gloss, and its
description built from parts, which opens the parts that stand in any one slot. The attestation
section lists the lines of the recorded corpus where the character stands, with the source and its
licence; a character outside the corpus says so.

## Data

- `app/data/tangut-entries.json.gz`: meanings and readings, from [Open
  Tangut](https://github.com/imlooh/open-tangut) (MIT), which merges CCAMC and Wiktionary entries.
- `app/data/tangut-cangjie.json.gz`: Cangjie codes, from [RIME Tangut
  Cangjie](https://github.com/tulenkius/rime_tangutcjkk) by Hulenkius, after the scheme of Kawasaki
  Keigo (2016). The table carries a warning about wrongly encoded characters.
- `app/data/tangut-attestation.json.gz`: lines of the corpus, built from the Glyph Atlas records of
  Solonin and Arakawa's *Bodhicaryāvatāra in Tangut Translation* (CC BY 4.0) with line readings from
  ぶんぽ, by `scripts/build_tangut_attestation.py`. A character outside chapter 2 shows no
  attestation yet.

## Development

```sh
bun install
bun run dev        # the site
bun run check      # types and Svelte checks
bun run build:app  # the static site into dist/
```

The glyphs are set in Noto Serif Tangut from Google Fonts; a browser with the font installed uses it
first.

The added code is MIT; see `LICENSE`.
