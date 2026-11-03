# The 文海's four-character construction

A 文海 entry opens with at most four characters that say how the glyph is built from parts of other
characters. The site's IDS data describes the same characters by containment. This note asks whether
the first can be turned into the second, and measures the answer on the constructions BabelStone's
draft carries.

## The formula

CCAMC describes the 文海's entry as three parts: first four characters analyse the glyph, mostly by
composition; a composition may take a character's upper, lower, left, right, middle, greater part or
whole; then a longer definition; then a fanqie. BabelStone lists the terms the analysis uses and
notes that others appear; these 60 cells use seven:

| Term | Reading | Meaning |
| --- | --- | --- |
| 𘓳 | *ŋowr | whole |
| 𘊱 | *pha̱ | left |
| 𘁝 | *nji̱j | middle |
| 𗡼 | *bji̱r | right |
| 𗥦 | *ɣu | head, top |
| 𗘡 | *tśhjɨj | bottom |
| 𘍞 | *iọ | surrounding, enclosing |

A source followed by a term is that part of the source; a source with no term is read as the whole
character. No more than four characters are used, so terms are often left out. 1.05.173 (𗷼𗦮𗛮𘊱)
names two sources with no term and one with left. The head's parts show the two bare sources are not
whole characters here: the default is only a reading, and the head has to supply the missing terms.

## Method

`scripts/eval_wenhai_composition.py` reads the 60 construction cells in
[Wenhai.html](https://www.babelstone.co.uk/Tangut/Wenhai.html), turns their Private Use Area glyphs
into Unicode through [WHYJ_Index.html](https://www.babelstone.co.uk/Tangut/WHYJ_Index.html) and
[nkay0's Li Fanwen 2008 table](https://github.com/nkay0/Tangut-rhyme-dictionaries-data) — the
conversion `scripts/check_babelstone_wenhai.py` uses for the fanqie — cuts the named part out of the
source's IDS in [`data/tangut-ids.tsv.gz`](../data/tangut-ids.tsv.gz), and compares the parts with
the head character's own IDS. It writes nothing.

## Result

| | |
| --- | --- |
| constructions | 60 |
| read to Unicode | 60 |
| two parts / three parts | 56 / 4 |
| every part cut from its source | 43 (71.7%) |
| … rebuild the head's top level | 26 of 43 (60.5%) |
| … are subtrees of the head | 31 of 43 (72.1%) |
| … cover every leaf | 33 of the 37 whose parts fall on a run (89.2%) |
| … fall on a contiguous run of leaves | 37 of 43 (86.0%) |
| mean leaf coverage, on those 37 | 95.5% |

1.05.131 works end to end: 𘀏 is ⿰𘤏𘦑; the left of 𘀑 (⿰𘤏⿱𘠙𘤊) is 𘤏, and the right of 𗩝
(⿲𘢌𘢡𘦑) is 𘦑.

The 17 entries that do not resolve, 19 parts between them, fail at the cut. The 文海 takes a part
that crosses the IDS's top-level grouping, so the IDS tree cannot supply it:

- **1.05.132**, target 𘀑 (⿰𘤏⿱𘠙𘤊): the surrounding part of 𘀏, whose IDS is ⿰𘤏𘦑 and has no
  enclosing operator.
- **1.05.173**, target 𗆠 (⿲𘠐𘨃𘢌): the left of 𗛮 (⿱𘡩⿰𘢌𘣦). The left side lies inside the
  bottom half; the IDS top level is vertical.
- **1.06.111**, target 𗌭 (⿰𘠤𘧲): the surrounding part of 𗌮 (⿱𘣋⿰𘠈𘣟) and the bottom of
  𗷾 (⿰𘣟𘦂), both cuts that cross the source's top level.

One of the four three-part formulas (1.05.173) fails at the cut; the other three cut cleanly and
fail against the head, because their bare sources read as whole characters do not land in the
head's leaves. That is the elision gap: the head has to say which part each bare source contributes.

All six surrounding uses in the 60 fail the cut, so the choice of the enclosing operator's outer
child is not exercised by this sample.

## What the four characters give

A component code: 56 of the 60 read as source + part pairs, and when the cut agrees with the IDS the
parts rebuild the head — 26 of 43 exactly at the top level, 33 of the 37 that fall on a run covering
every leaf, with the parts on a contiguous run of leaves in 37 of 43. They are a starting point for a
decomposition, not a decomposition algorithm. Two layers are missing:

1. **The cut.** The 文海 cuts the glyph's geometry; the IDS records containment. A horizontal cut
   through a vertically grouped source, or a surrounding relation the IDS does not encode, needs a
   part vocabulary over the glyph rather than the IDS top level.
2. **The elision.** A bare source may be any part, and only the head says which. The code is
   complete only when the elided terms are supplied by a reader or by the head's glyph.

BabelStone's own warning applies to the result: the 文海 analysis "does not always make sense", and
whether it reflects the script's design or a later rationalisation is open. The 60 rows are
BabelStone's transcription of 文海研究 (1983), not the manuscript, and none of them carries a
definition. The counts describe this sample, not the whole 文海.

## Run

```sh
uv run python scripts/eval_wenhai_composition.py [--pages DIR] [--csv FILE] [--formulas FILE] [--ids FILE]
uv run python -m unittest discover -s scripts -p test_wenhai_composition.py
```

`DIR` holds saved copies of the three BabelStone pages under their own names.

## Other corpora

`--formulas FILE` reads a JSONL table instead of BabelStone's pages, one object per line:

```json
{"position": "1.05.131", "character": "𘀏", "formula": "𘀑𘊱𗩝𗡼"}
```

`formula` is the entry's construction characters in order, using the seven terms above; `position`
is optional. A construction that uses another term needs the vocabulary extended first. The 2008
夏漢字典's fuller construction text can be converted to this form; the caller cites the edition. The
same table was run on BabelStone's 60 rows: the two paths print identical counts and failures.

## The card's table

The card reads [`app/data/wenhai-composition.json`](../app/data/wenhai-composition.json).
`scripts/build_wenhai_composition.py` writes it from BabelStone's pages; with `--formulas FILE
--source '…'` it writes it from a construction table, so the fuller 2008 corpus can replace the 60
rows without hand editing. Both paths produce the same entries; the page path writes the committed
file's citation, so it matches byte for byte, and the table path matches when `--source` is that
citation.

```sh
uv run python scripts/build_wenhai_composition.py --pages DIR --csv FILE
uv run python scripts/build_wenhai_composition.py --formulas FILE --source 'edition'
```

## Sources

- [CCAMC, 文海](http://www.ccamc.org/tangut_wenhai.php) — the three-part entry and the parts a
  composition may take.
- [BabelStone, Wenhai.html](https://www.babelstone.co.uk/Tangut/Wenhai.html),
  [WHYJ_Index.html](https://www.babelstone.co.uk/Tangut/WHYJ_Index.html) and
  [WenhaiUnicode.html](https://www.babelstone.co.uk/Tangut/WenhaiUnicode.html) — the skeleton, the
  index-font numbers and the Unicode head characters.
- [BabelStone, "Untangling the Web of Characters"](https://www.babelstone.co.uk/Blog/2010/04/untangling-web-of-characters.html)
  (2010) — the seven part terms, their readings, and the 102-character case study; also the warning
  that the analysis does not always make sense.
- [nkay0, Tangut rhyme dictionaries data](https://github.com/nkay0/Tangut-rhyme-dictionaries-data) —
  Li Fanwen 2008 number to Unicode.
- [`data/tangut-ids.tsv.gz`](../data/tangut-ids.tsv.gz) — BabelStone IDS (Andrew West, public
  domain), the descriptions compared here.
