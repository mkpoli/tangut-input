# 文海 constructions

The 60 four-character construction cells in BabelStone's draft of the 文海 (Wenhai.html), one JSONL
object per line:

    {"position": "1.05.131", "character": "𘀏", "formula": "𘀑𘊱𗩝𗡼"}

`position` is the 文海 page/position; `character` is the head character; `formula` is the
construction's characters in order, two to four. A source with no part term after it is an elided
term: the evaluator reads it as the whole character, and the card builder writes it as `null`.

The rows are BabelStone's transcription of 史金波 et al., 文海研究 (1983), with the Private Use Area
glyphs converted through the WHYJ index and nkay0's Li Fanwen 2008 table. The part terms and their
readings are from Andrew West, "Untangling the Web of Characters" (2010). No licence is stated; the
60 rows are a cited excerpt.

`scripts/eval_wenhai_composition.py --formulas data/wenhai/constructions.jsonl` measures them
without the pages; `scripts/build_wenhai_composition.py --formulas … --source '…'` writes the
card's `app/data/wenhai-composition.json`. The full 2008 夏漢字典 table can replace this file.
