# 番漢合時掌中珠

A machine-readable transcription of the 1190 Tangut–Chinese glossary, keyed from the National
Institute of Japanese Literature's scan of a Republican-era 貽安堂 printing. The site will read it as
a concordance layer: Tangut character ⇄ the Chinese character that transcribes it.

## The source

[国書データベース, DOI 10.20730/100354804](https://kokusho.nijl.ac.jp/biblio/100354804): 46 IIIF
canvases, 5766 × 4978 px, held by 清光山西巖寺 (shelfmark 156/西巖297), photographed 令和元年度,
CC BY-NC 4.0. `source.yaml` and `witnesses.tsv` carry the record.

It is a printed reproduction, not the Khara-Khoto manuscript: 貽安堂 經籍鋪 printed it in the 民國
as the first item of 絕域方言集. It carries the Tangut as well as the Chinese — canvas 4 is the title
page, canvas 5 the series title facing a Tangut preface — so the columns on a body page are all
there; what has to be settled is their order within an entry.

A reading of a damaged glyph needs a second witness before it is called certain. `source.yaml` lists
the 甲乙本 facsimile on Commons under `comparisons`: leaves of both manuscript copies, at about
1237 × 1752 px per page, enough to compare a character and not enough to key from. The images stay
in `cache/` and are not redistributed. The non-commercial term governs the images, not the keyed
rows; the rows' own licence is not settled.

## What the page gives

Entries run down the page in bands; each band reads right to left. Columns, as the original prints
them: the Tangut headword; a Chinese transcription with one Chinese character per Tangut character;
the Chinese gloss; and the Tangut spelling of the Chinese. The transcription column is the reason to
key this text — no other source gives a Chinese character for an individual Tangut character.

## Files

| File | One row per |
| --- | --- |
| `source.yaml` | the work |
| `witnesses.tsv` | physical copy |
| `leaves.tsv` | canvas, with the role it plays in the book |
| `entries.tsv` | entry |
| `cells.tsv` | character position within an entry |
| `variants.tsv` | printed form → standard form, with its evidence |

`leaves.tsv` marks `surveyed=1` only where the canvas was opened and read; rows marked 0 are
provisional and must be re-checked before the page order is quoted anywhere.

### entries.tsv

`entry_id` is `zzz:<witness>:<seq>`, the running number once keyed, so a second witness or a
re-photograph does not renumber the text. `canvas`, `side`, `band` and `seq` say where the entry sits,
not what it is: `seq` counts columns from the right edge of the band, because the bands read right to
left. `gloss_status` is `ok`, `uncertain` or `illegible`.

`x0` and `x1` are the column's left and right edge in native pixels, and they are the anchor a row is
read back from: `seq` counts detected columns, and where the detector merges two columns the count
drifts, so a row with both is checked against its pixels.

`column_role` says what the keyed column is: `gloss`, `transcription`, `tangut` or `unknown`. A row
may hold a single column while the entry it belongs to is still unestablished — the first rows do,
and their `notes` say so. That is deliberate: a column can be read from the image, a grouping cannot
without knowing which columns are Tangut, and writing the grouping first would put a claim into the
data that the evidence does not carry.

### cells.tsv

One row per character position and role. `role` is `tangut`, `transcription` or `gloss_spelling`,
and positions run 1..n within each role, so a two-character headword with two transcription
characters is four rows. `status` is `ok`, `uncertain`, `illegible` or `absent` — `absent` means the
print has no character at that position, which is a reading and not a gap. A position with no row is
untranscribed. `glyph` is what the print shows; `glyph_norm` is the standard form from
`variants.tsv`. `checked_against` names a second witness or edition when the reading was checked
against one, and is empty when this print is the only evidence.

`ok` requires `reviewer` and `reviewed_date`. A reading of a damaged glyph stays `uncertain` until
a second witness confirms it, whatever the reviewer's confidence.

Do not assume the transcription column has as many characters as the Tangut column. Where the counts
differ the difference is the finding, and it belongs in `glyph_note`.

## The worksheet

`scripts/segment_zhangzhongzhu.py --canvas 40 --pages` cuts one canvas into its two pages and their
bands, writes one PNG per band under `cache/zhangzhongzhu/` with a ruler in native pixels and a
suggested boundary on every column with its number in reading order, and prints the bands as TSV.
The columns are numbered right to left, column 1 at the right edge of the page, and the same numbers
are written to `cache/zhangzhongzhu/<canvas>-columns.tsv` with their native-pixel ranges. The
boundaries are a suggestion: the print rules the entry groups but not every column, so each one has
to be confirmed by a reader who can tell the Tangut column from the Chinese ones. Record the
confirmed boundary as a number, not as a description.

`--grid` writes the two pages with a labelled grid every 100 pixels and no detected boxes. Read
positions from that image: the bands are not ruled in this print, and the row profile starts each
detected box partway down a row, so its boxes are a hint and not a boundary.

Run it over the whole book when starting a review:

```sh
for i in $(seq 1 46); do uv run scripts/segment_zhangzhongzhu.py --canvas $i --pages; done
```

Canvases 2 and 46 are the covers and the script declines them; the other 44 give 216 bands and 2,062
numbered columns, written under `cache/zhangzhongzhu/` as `<canvas>-page-l.png`, `<canvas>-l-<band>.png`
and so on, with `<canvas>-columns.tsv` holding the numbered ranges.

## Work still to settle

1. **Column grouping.** Inside a ruled group the transcription and the gloss stand side by side
   without a divider, so which characters belong to which has to be settled band by band. The
   worksheet is the place to do it; the entry count is unknown until it is done.
2. **Keying the Tangut.** The headword characters are legible at full resolution; identifying them
   means matching the printed form to a code point, then checking it against `tangut-entries.json.gz`
   and the 文海 reading. Nothing is keyed from shape alone.
3. **Section headings.** The nine sections of the glossary (天, 地, 人 …) have to be located on the
   canvases before `section` can be filled.

## Scripts

```sh
uv run scripts/fetch_zhangzhongzhu.py --canvas 40                    # native canvas to cache/
uv run scripts/fetch_zhangzhongzhu.py --canvas 40 --crop 14,18,14,13 --size 1600
uv run scripts/segment_zhangzhongzhu.py --canvas 40 --pages          # page and band images
uv run scripts/segment_zhangzhongzhu.py --canvas 40 --grid           # page with a 100 px grid
uv run scripts/check_zhangzhongzhu.py                                # validate the tables
```
