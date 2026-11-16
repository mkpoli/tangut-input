# Is the 文海 construction an input code?

A 文海 entry gives two different four-character things, and the difference decides the input
question.

- The **construction** is the first four Tangut characters: source characters and which part of each
  the glyph borrows. The card shows it; [the construction note](wenhai-composition.md) measures it.
- The **definition** is the longer gloss that follows; its core is often four characters, such as
  青玄色也. The site searches this text as a meaning, in Find, after the ordinary glosses.

The four-character definition is sometimes read as a decomposition of the glyph. The construction is
the dictionary's actual decomposition; this note asks whether it can be typed.

## What the construction names

1.05.131, 𘀏 "a surname": left of 𘀑 "a kind of bird" and right of 𗩝 "horn". The sources are
phonetic here; "bird" and "horn" say nothing about a surname. 1.05.141, 𗱏 "to choke": top of
𗨬 "narrow" and right of 𗍂 "throat"; these are semantic. BabelStone notes that either relation
occurs, and that the relation belongs to the source character, not to the borrowed stroke.

## Code space on the 60

| code | distinct | collisions |
| --- | --- | --- |
| full formula (4 characters) | 60 | 0 |
| source characters (2–3) | 60 | 0 |

The 60 are 2% of the 3,063 head characters; no collision in 60 says little about the dictionary. The
first example shows why a meaning sequence is not the head's meaning. The counts come from
[`scripts/study_wenhai_codes.py`](../scripts/study_wenhai_codes.py) on
[the 60 rows](../data/wenhai/constructions.jsonl).

## Why it is not a keyboard

- Typing the sources needs another Tangut input method; the code is circular.
- A source may be phonetic, so a code built from its meaning is wrong for the head.
- The construction describes a character the reader has already found; the person typing has not
  found it yet.

## What the data is for

- **The card.** Show the construction for the characters that have one; 60 today, the full table
  later.
- **Ranking an analysis.** The construction's parts can confirm or order candidate IDS analyses.
  With the head known, `--choose` resolves 39 of 60 and rebuilds 28 exactly; the strict pass has 31
  and 26.
- **The meaning side.** Find already searches the 文海 gloss; a fuller table adds more glosses, not
  a new code.

## The input paths

The site enters a character by Cangjie, reading, meaning, parts and drawing. The construction
explains how a known character is built; the finders above are how one is typed. A meaning query
over the 文海 gloss is the input side, and it is already in Find.

## Next

With the full 2008 table: extend the card and the ranking. A standalone 文海 keyboard is not
supported by the 60-row evidence; if the full data shows a workable subset, that would be a new
question.

## Sources

- [The construction measurement](wenhai-composition.md) and
  [`data/wenhai/constructions.jsonl`](../data/wenhai/constructions.jsonl) — the 60 rows and the
  strict/head-assisted counts.
- [Open Tangut](https://github.com/imlooh/open-tangut) — the English glosses quoted in the first
  example.
- [BabelStone, "Untangling the Web of Characters"](https://www.babelstone.co.uk/Blog/2010/04/untangling-web-of-characters.html)
  (2010) — the phonetic/semantic relation of a source character, and the warning that the analysis
  does not always make sense.
