# Tangut Input: design

## The model

The site has three parts.

- **The text.** One piece of writing per browser, kept in local storage and pinned under the top
  bar. Every finder inserts into it at the caret, so a character found by Cangjie and one found by
  drawing land in the same place. It can be typed or pasted into directly, and copied as text, as
  code points or as Cangjie codes. Clicking beside a character in it opens that character's card.
- **The finders.** One page for each way of naming a character: Find, Cangjie, Reading, Draw and
  Parts. Their inputs differ in kind (letters, a reconstruction, a drawing, a set of components),
  so each page is laid out for its own input; there is no shared box with tabs.
- **The card.** Everything recorded about one character, with the actions first: add to the text,
  copy the character, copy the link, copy the code point (click it) or a Cangjie code (click it).
  Below them come the things that help a reader confirm the character is the one they mean:
  meaning, readings, structure, the lines of a text where it stands, and related characters.

A visit runs: name the character in whatever form you have, check it in the card, then put it to
use. Highlighting a candidate (arrow keys, hover in the Cangjie bar) previews it in the card; a
click opens it; a double click, `Enter` or a Cangjie number key adds it to the text.

## The frame

**Desktop (1440×900).** Top bar with the five finders and Sources; the text strip under it; the
finder on the left and the card in a fixed 440 px column on the right, scrolling on its own. The
card stays visible while candidates change, so meaning and reading are read alongside the list.

**Phone (390 wide).** The finders move to a bottom tab bar. The card becomes a full-height sheet
that a tap opens and Back or `Esc` closes; previews from the keyboard do not open it. The text strip
stays at the top.

## The finders, and why each sits where it does

**Find** (`/`) is the landing page and the general lookup. One box reads whatever is typed:

- Tangut text is split into its characters, each with its gloss and reading (Li Fanwen, or the
  first system that has one). A student can paste a line and read it character by character.
- Latin letters are tried at once as a Cangjie code, as a reading and as an English meaning. Each
  interpretation is a separate group with a link to continue in its own finder, so the ambiguity of
  `do` (code or reading?) is shown instead of guessed.
- `U+17…` or bare hex lists code points; Chinese and Japanese are read as meanings.

With an empty box, the page shows the four finders as doors with one line each, and examples.

**Cangjie** (`/cangjie`) is for the expert and the learner. It behaves like an input method: the
code box takes letters, candidates are numbered 1–9, `Space` or a digit commits into the text,
`←`/`→` move the highlight, `↑`/`↓` page, `Esc` clears and `Backspace` in an empty box deletes
from the text. Each candidate shows its code with the typed letters dimmed and the remaining ones
dark, which teaches the code while it completes it.

Below the box, an on-screen keyboard doubles as the key chart. Each key shows the shapes it names
(the components whose whole code is `p` plus that letter) and dims when no code continues with it,
so a learner sees which letters can follow. On a touch screen it is the keyboard: the code box
asks the system for no keyboard of its own.

Beside the keyboard sits the component palette, all 883 characters with a component code, grouped
by the letter after `p`, each with its code under it. Typing a code beginning `p` jumps the palette
to its group and marks the matching components.

**Reading** (`/reading`) searches all eight systems at once, because a reader knows one system and
nobody agrees on one. Each reading is folded to plain letters (diacritics dropped, IPA mapped to
the nearest Latin letter, separators removed) with a final digit kept as the tone. Results come in
four tiers (exact, begins with, near, near and begins with), where *near* also ignores medial `j`
and `y` and a prenasal before a stop. Every row shows which systems read the character so and how,
in their own spelling, with a short gloss. Tone buttons (any, 1 level, 2 rising) or a typed final
digit keep to one tone; systems without tones always pass. Systems can be narrowed with chips.

**Draw** (`/draw`) is a square pad with a centre cross, undo and clear. After each stroke the 48
closest glyphs appear. The match compares where ink lies (see *Drawing search* below), so the page
carries a plain note of how rough it is, with measured figures, and points to Cangjie or a reading
when the user has one. A checkbox favours characters whose recorded stroke count is near the
number of strokes drawn; another adds components to the search. On a phone, results come straight
after the pad and the note follows them.

**Parts** (`/parts`) builds a character from components, as the script is built. Each chosen part
keeps only the characters whose description holds it (twice if chosen twice), and the palette
below keeps only the parts that still occur, with a count on each, so the next choice always leads
somewhere. An outer layout (side by side, above and below, three across …) narrows further. The
palette is ordered by stroke count, then by use, and can be filtered by Cangjie code. Choosing a
part also opens it in the card. A card's “Characters with these parts” link opens Parts with that
character's parts chosen.

## The card

- Large glyph on a centre cross, code point (click to copy), first English sense, strokes, radical
  (click to open).
- Add to text, Copy the character, Copy link.
- Cangjie codes, short and full, each click-to-copy, and “Type it” into the Cangjie page.
- Meaning in English (numbered senses), Japanese and Chinese.
- Readings in eight systems and the two sound glosses (Li Fanwen, Nie Lishan).
- 文海 gloss where the records have one (twelve entries).
- **Built from**: the description drawn as nested frames that follow its layout (a row for ⿰, a
  column for ⿱, and so on), every part a button to its own card; the raw IDS string, click to copy.
- **In a text**: for each place in the corpus, the scribe's form cut from the facsimile, the line
  with the character marked (other characters open their cards), the edition's English line, the
  line number and page, and a link to ぶんぽ's reading of the line. Then the full citation and
  rights. Outside the corpus it reads “Not yet recorded”, with the corpus size, so absence never
  reads as “not a character”.
- Characters that use this one (for components), characters described the same way, characters
  with the same Li Fanwen reading.
- Source line for the records.

## Addresses

Every state worth sharing is in the URL: the finder in the path, the open character as `?c=17E39`
(hex code point), the finder's query as `?q=`. A link to `/parts?q=𘠀𘠆` opens Parts with those two
parts chosen; `/?q=…` opens Find with the text. Cloudflare's single-page fallback serves the app
for every path.

## Visual identity

Warm paper and ink with one vermilion accent, used only for what acts (the primary button, focus,
the highlighted candidate) and for the mark. Tangut is set in Noto Serif Tangut; Latin headings and
readings in a book serif from the system; interface text in the system sans; codes in the system
monospace. Light and dark are `light-dark()` pairs; the theme follows the system unless the switch
in the top bar fixes it. The mark is 𘅤 (U+18164), glossed “to write” in Open Tangut, drawn from the
font into the favicon.

Google Fonts' Noto Serif Tangut lacks the newest components (U+18AF3–18AFF, U+18D00–18D08), so a
4 KB subset of the bundled version 2.168 covers those code points. Characters no font draws yet
(U+187F8–187FF, U+18D80 onward) appear as their code point in a dashed box.

## Drawing search

Every glyph in Noto Serif Tangut 2.168 (6,913: ideographs and components) is rendered, cropped to
its ink and stretched to fill a 32×32 mask (`scripts/build_tangut_shapes.py`,
`app/data/tangut-shapes.bin.gz`, 540 KB, fetched only by the Draw page). A drawing is stretched the
same way and drawn with a fixed pen. Each glyph is scored by a two-way chamfer distance: the mean
distance from the drawing's ink to the glyph's ink plus the reverse. A lone stroke keeps a sliver
shape instead of being blown up into a block. Ranking 6,913 glyphs takes a few milliseconds.

`scripts/eval_tangut_shapes.mjs` measures it on synthetic drawings: a glyph thinned to a skeleton,
stretched and sheared at random, and optionally warped along a slow wave. On 1,000 drawings:

| Drawing | Top 1 | Top 5 | Top 20 |
| --- | ---: | ---: | ---: |
| thinned, skewed | 79% | 90% | 95% |
| + warp of 1 cell (3% of the square) | 57% | 75% | 84% |
| + warp of 2 cells | 10% | 19% | 26% |

The test input comes from the same font, so these are upper bounds. Real handwriting will usually
sit nearer the last row. The page states the first and last figures in plain words.

## Decisions taken without asking

- **Find as the landing page.** A student arriving with a reading, a meaning or a pasted line
  needs one box that takes any of them; an expert bookmarks `/cangjie`.
- **One text, local only.** The brief allows no accounts or server state. A single buffer in local
  storage is the simplest thing that lets a character found by any method land in one place.
- **No meaning finder of its own.** Meanings are searched from Find; the brief lists four input
  methods and meaning search is a lookup, not an input.
- **Attestation rebuilt from Glyph Atlas.** The old file carried only line numbers. The builder now
  carries each line's text, English translation, page and reading link, and cuts 280 facsimile
  crops (greyscale WebP, 128 px high, 385 KB, loaded lazily) from the edition's strips. The edition
  is CC BY 4.0; the credit is printed under every attestation.
- **Unused or unattributed data left out.** `app/data/tangut-parts.json.gz` (a list of characters
  with use counts) is deleted: the counts are recomputed from the descriptions at load.
  `data2/tangut-corpus.json.gz` (21 Tangut texts) would give frequencies for ranking, but nothing in
  the repository records its source or licence, so the site does not read it.
- **Stroke counts** come from `data2/tangut-strokes.json.gz`, copied to `app/data/` because the app
  reads only from there.
- **No dev server in the screenshots.** `scripts/shoot_app.mjs` drives Chromium against `dist/`,
  answering the site's requests from disk.
- **UI in English only.** The old workshop's message catalogues belong to the IDS editor.

## What is real, stubbed, missing

**Real, against the data:** all five finders; Cangjie prefix search over 11,805 codes with
next-letter counts; reading search over 29,525 readings in eight systems; drawing search over
6,913 glyphs; part search over 6,136 descriptions; the card with every field the records carry;
attestation of 151 characters in 40 lines with 280 facsimile crops; the text buffer with three
copy formats; shareable URLs; light and dark; phone layout.

**Rough by nature:** drawing search (figures above); the reading folds are a convenience mapping,
and the *near* tier is a heuristic.

**Missing:** an IME, OCR of manuscript images, a stroke-based handwriting recognizer, frequency
ranking (no attributed corpus yet), localisation of the interface, corrections to codes the RIME
table marks as wrong, and an offline (service worker) mode.

## Where the repository's documents and code disagreed

- `README.md` linked RIME Tangut Cangjie at `github.com/tulenkius/rime_tangutcjkk`, which does not
  exist; the repository is `github.com/Hulenkius/rime_tangutcjkk` (corrected in the README).
- The brief places `data2/` under `app/data/`; it sits at the repository root.
- The brief describes the attestation file as carrying facsimile boxes; the checked-in file carried
  only line numbers and positions until it was rebuilt.
- `package.json` still describes the package as “A Tangut-only IDS editor” and exports the old
  `src/` library, which the site does not use.

## Screenshots

`docs/design/<screen>-<desktop|phone>-<light|dark>.png`, at 2× for 1440×900 and 390×844, from
`bun run build:app && bun scripts/shoot_app.mjs`:

- `find`: the landing page; `find-text`: a pasted line, glossed, with the first character's card.
- `cangjie`: `msb` typed, candidates, keyboard with dead keys, palette, card.
- `reading`: `ndzi` across systems.
- `draw`: a seven-stroke sketch and its closest glyphs.
- `parts`: two parts chosen, seven characters, the narrowed palette.
- `card`, `card-attested`: the card of 𗋕, and its structure and three attested lines.
- `sources`: the Sources page.
