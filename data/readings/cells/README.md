# Keying exports

One file per band and leaf of 番漢合時掌中珠, one line per printed column. `scripts/key_zzz_readings.py`
turns them into rows of `../readings.tsv`; `bun run check:cells` holds their shape.

## Naming

`<canvas>b<band><side>.tsv`, canvas 40 and up, band 1 at the top of the opening. `r` or `l` when only
one leaf was keyed; without a suffix the file covers both leaves, columns running right to left
across the opening.

`full39.jpg` is canvas 40 and `full40.jpg` is canvas 41. Each opening carries three bands, and the
folio number printed at the right fore-edge names the leaf: canvas 40 is folio 三十五, canvas 41 is
三十六 and holds the title that ends the work.

## The line

`canvas band index role glyph codepoints note`

- `index` counts printed columns from the band's right edge, 1 upward, across both leaves.
- `role` is `transcription`, `tangut`, `gloss` or `spelling`, in that order within an entry.
- `glyph` holds the Chinese characters of a transcription, gloss or spelling column; a `tangut` line
  leaves it empty.
- `codepoints` holds `U+XXXX` for each Tangut sign, top sign first.
- `note` starts `side=r` or `side=l`, gives every Tangut pair as `字→character 音reading`, and puts
  `certain`, `probable` or `open` in each pair's own piece. The converter reads those words: a piece
  with none of them inherits the row's fallback, and an `uncertain` result is held out of the build.

## What the page fixes

Four columns to an entry, and the Tangut column holds one sign per transcribed character. The last
group of a band may stop short: the band can end inside an entry, and `check:cells` says so without
failing. A small character beside a transcription character (a small 知, a small 尼) is the reading's
initial and belongs in the note, not in `glyph`.

## Finding the sign

A Tangut sign is identified from the print, so the work is narrowing 6,144 candidates to something an
eye can scan. Three passes, in order:

1. **Initial.** The Chinese character under the sign rules out most of the corpus:
   `bun run key:sheet 酩 m cache/zzz/酩.png` draws every sign whose Li Fanwen reading begins with that
   articulation, paged and sorted by stroke count. The filter keeps 22 of the 22 pairs already keyed
   from canvas 40 band 1, but a class runs 250 to 1,600 signs, so a sheet narrows and never decides.
2. **Shape.** The print is a bolder hand than any digitised face, so correlation ranks poorly: expect
   the true sign below shaved-hair and heart-shaped characters. Compare in `TangutN4694.ttf` (covers
   all 6,144) or `NewTangutStd.ttf` (6,136); the first crashes FreeType with `execution context too
   long`, which is why the sheets use the second. `BabelStoneTangutWenhai.ttf` covers only 3,061.
3. **Reading.** The 直音 is the last check, not the first: a clean shape whose reading contradicts the
   transcription is `probable` at best, and the note says why.

`cache/tangut-reading-draft.tsv` is a second opinion. It is never the reason a code point is written;
where it agrees with a shape already matched, the note records that it does, and where it disagrees,
the note records that too.

## Machine reading, so far

`FlagRain/tangut-mixocr` (MIT, ONNX, 5.7M parameters, 6,144-character vocabulary) is the first thing
that has read this print. It only reads horizontal lines, so a vertical column is cut into its four
glyphs, laid side by side, and read as one line. Its PP-OCR detector also finds the columns on the
unrotated band, 24 boxes of 137–205 px by 555–608 px, right to left in reading order, so the role of
each box follows from its place in the entry. Measured against the 24 signs of canvas 40 band 1 that
were already keyed by eye, equal four-way slicing of the column reaches 9 of 24; slicing on the ink
quantiles does worse, 5 of 24, and padding each glyph helps neither. Two columns read three of four,
two read two, and two are largely wrong, so the model proposes and the eye still decides.

## Adding a band

    bun run key:sheet <character> <initial> cache/zzz/<character>.png
    # key the band into cache/zzz/cells-<canvas>b<band>.tsv
    uv run scripts/check_cells.py cache/zzz/cells-<canvas>b<band>.tsv
    uv run scripts/key_zzz_readings.py --cells cache/zzz/cells-<canvas>b<band>.tsv --write
    uv run scripts/build_tangut_entries.py
    bun run verify

Move the export into this directory once it passes, so the evidence stays beside the table it feeds.
