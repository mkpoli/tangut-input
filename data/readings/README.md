# Readings

The values keyed out of the books in `../books/`, one printed value per row, each with the page it
stands on. This is where the columns CCAMC used to carry come back: they are keyed from the editions
and cited, so a reader can open the page and check the reading rather than take it on trust.

The files are keyed by hand. The scans carry no Tangut text layer, so the Tangut side is confirmed by
eye against the printed glyph and written down as its code point; the readings and glosses are
Chinese and Latin script and are typed, not OCR'd.

## Where a keyed band comes from

An image model reads one 掌中珠 band off the scan and writes an export beside the page: a row per
glyph, with the canvas, the band, the column, the role, the glyph and its code point, and a note
naming the pair it reads and how sure it is. `scripts/key_zzz_readings.py` turns that export into
rows of the table below, one per transcription character, and pairs each with the Tangut code point
in the same column; `--write` merges them into the table, replacing the rows of that canvas.
`cache/zzz/` holds the exports while a page is being keyed.

## Table

`readings.tsv`, one row per printed value:

| Column | Holds |
| --- | --- |
| `char` | the Tangut character, as one code point |
| `field` | the entry key the value fills, from the list below |
| `value` | the printed text, verbatim, in the script it is printed in |
| `work` | the book, an `id` from `../books/source.yaml` |
| `locator` | where on the page: see below |
| `note` | damage, a variant, a second witness — what a keyer has to say; for a `tibetan` row the card shows it where a book title stands, so it names the source |
| `status` | `keyed` (read once), `checked` (read again and matched), `uncertain` (a doubtful glyph or character) |
| `checked` | the date of the last reading, `YYYY-MM-DD` |

Fields:

| Field | Holds | Work |
| --- | --- | --- |
| `sound_li_fanwen` | 李范文's reading: the 聲類, the fanqie, the 直音 | `xiahan-zidian` |
| `sound_nie_lishan` | 聂历山's reading | `nevsky-1960` |
| `arakawa_shintaro` | Arakawa's reconstruction | `arakawa-tsuin` |
| `gong_huangcheng` | Gong Hwang-cherng's reconstruction; a keyed value replaces the one in `data/gong-xun/ghc.json.gz` and cites the page that prints it | `ghc-2002`, `ghc-2005` |
| `tibetan` | the 藏文對音 field, which is not a book and names its source in `note` | `-` |
| `wenhai_zh` | the 文海's own text on the character | `wenhai-yanjiu` |
| `gloss_zh` | the Chinese meaning, a dictionary's own wording | `xiahan-zidian` |

A 直音 read from 掌中珠 into `sound_li_fanwen` names `zhangzhongzhu` as its work and cites the canvas:
掌中珠 prints a Chinese character for a Tangut one, which is the 直音 itself, and 夏漢字典 is the
second reading. `uv run scripts/check_readings.py` holds the shape; it does not judge a reading.

## Locators

- `zhangzhongzhu`: `canvas <n>`, `band <n>` and `c<n>`, the column's number counting from the band's
  right edge. The Tangut column stands one column to the right of the Chinese one that reads it.
- a book with `pages` in `source.yaml`: `p.<n>`, with a line and a column where the entry is not
  alone on the page, e.g. `p.742 col 2`.
- `nevsky-1960`: `vol <n> p.<n>`; the two volumes are separate files. A work printed in one volume
  takes no `vol`.
- `tibetan`, whose work is `-`: the manuscript and folio as the index gives them, e.g. `Or.12380/1842
  fol. 3a`, free text since no work fixes the shape.

## What a row must carry

A value stands alone only when the page prints it plainly. A damaged or doubtful glyph is
`uncertain`, and gets a second witness — the other 掌中珠 copy, or the dictionary's own recap — before
the status rises. An uncertain row is held back from the build until then, so the card never shows a
reading nobody has confirmed; its `note` says what is doubtful. Nothing here is retyped from another site: a value that only CCAMC carries is
keyed again from the edition and the page is found afresh.

The non-commercial terms of the 掌中珠 photographs and the copyright in the other editions govern the
images; the keyed rows are published with their citation.
