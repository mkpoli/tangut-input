# BabelStone Dragon King page

The parallel Tangut and Chinese text of the *Sāgara-nāgarāja-paripṛcchā* (T599) on Andrew West's
BabelStone page, <https://www.babelstone.co.uk/Tangut/DragonKing.html>, read 2026-11-07.

`dragon-king.tsv` holds the page's 26 `tangut<TAB>chinese` pairs in page order:
`scripts/fetch_babelstone_dragon_king.py` writes it. The Chinese is 義淨's translation,
*佛為海龍王説法印經*, as the page prints it, punctuation included. The Tangut column aligns each
Chinese line with the Lausanne corpus transcription of the same text; the corpus keeps the LCDTT
lines, and the build stops if one of them no longer matches a page line. The page's title pair is
kept in the table, but the LCDTT transcription drops headings, so no corpus line carries it.

The page states no licence. The Chinese is a public-domain translation; the Tangut transcription
and the line-by-line alignment are West's. The page's bibliography records the text's first
publication in West's Twitter thread, Nishida Tatsuo's catalogue no. 179, E. D. Grinstead, "The
Dragon King of the Sea", *The British Museum Quarterly* 31.3/4 (1967), 96–100, IDP Or.12380/3621
and CBETA T15n0599.

`scripts/build_tangut_attestation.py` adds the Chinese to the LCDTT Dragon King lines and to the
Wikisource transcription of the same text, and the [Texts page](../../app/pages/Texts.svelte) shows
it under the Tangut lines.
