# Tangut fonts

- **Noto Serif Tangut** (default, from Google Fonts). SIL Open Font License 1.1.
  `OFL-NotoSerifTangut.txt`. `NotoSerifTangut-supplement.woff2` is a subset of Noto Serif Tangut
  2.168 holding only the characters Google Fonts' copy lacks.
- **Tangut Yinchuan** (唐兀銀川), designed by Jing Yongshi (景永時) and completed by Andrew West
  (<http://www.babelstone.co.uk/Fonts/Yinchuan.html>). The font carries the holders' terms: free to
  download and use, no modification, no sale, no redistribution for profit, and an acknowledgement
  of Jing Yongshi's copyright when it appears in a publication. It is served unmodified from this
  site.
- **BabelStone Tangut Wenhai**, Andrew West, SIL Open Font License 1.1. Noto Serif Tangut draws
  every character this font does and more, so the site serves only a complement subset of the
  characters Noto lacks (`BabelStoneTangut-complement.woff2`): the components and the newest
  ideographs. The full font is in this directory for rebuilding that subset.

- **Tangut IPA** (`TangutIPA-Regular.woff2`). A subset of Charis 7.000 (SIL, <https://software.sil.org/charis/>), cut to Latin, IPA extensions,
  spacing modifiers, combining marks, dashes and superscripts for the reconstruction input and results.
  Copyright (c) 1997–2025 SIL Global, SIL Open Font License 1.1 (`OFL-Charis.txt`); the subset is
  renamed because the licence reserves the name Charis.

- **IDS Operators** (`IDS.woff2`). The sixteen ideographic description characters U+2FF0–2FFF,
  subset from **GenZui Sans** (Source Han Sans-based, SIL Open Font License 1.1; `OFL-GenZuiSans.txt`
  in `fonts/`). 2 KB, so a description can always be shown as its own text. Rebuild it with
  `pyftsubset fonts/GenZuiSans-Regular.woff2 --unicodes=U+2FF0-2FFF --flavor=woff2`.

Rebuild the Noto supplement, the BabelStone complement and the N4694 supplement with `bun run build:tangut-fonts`.

- **Tangut N4694** (version 18), from the 古今文字集成 font page (ccamc.org/fonts_tangut.php),
  copyright 2026 www.ccamc.org; the name table credits Jerry You. No licence text ships with the
  archive; the font is served for this personal tool. `TangutN4694-supplement.woff2` is a subset
  holding U+18D09–U+18D20 and U+18D80–U+18DF2, the supplement ideographs and components the other
  faces lack, made with `bun run build:tangut-fonts`; its `unicode-range` also covers the unassigned
  slots between them.

- **New Tangut Std** (新西夏字體), from the 古今文字集成 font page (ccamc.org/fonts_tangut.php),
  where it is offered for download alongside Noto Serif Tangut; it is described there as built
  from 文海, 同音 and 同義 with the script's structures corrected. No licence text ships with the
  archive; the font is served for this personal tool. `NewTangutStd-complement.woff2` draws the
  Tangut components with Noto Serif Tangut, which this font leaves out.
