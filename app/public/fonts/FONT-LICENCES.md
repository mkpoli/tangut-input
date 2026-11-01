# Tangut faces

- **Noto Serif Tangut** (default, from Google Fonts). SIL Open Font License 1.1.
  `OFL-NotoSerifTangut.txt`. `NotoSerifTangut-supplement.woff2` is a subset of Noto Serif Tangut
  2.168 holding only the characters Google Fonts' copy lacks.
- **Tangut Yinchuan** (唐兀銀川), designed by Jing Yongshi (景永時) and completed by Andrew West
  (<http://www.babelstone.co.uk/Fonts/Yinchuan.html>). The font carries the holders' terms: free to
  download and use, no modification, no sale, no redistribution for profit, and an acknowledgement
  of Jing Yongshi's copyright when it appears in a publication. It is served unmodified from this
  site.
- **BabelStone Tangut Wenhai**, Andrew West, SIL Open Font License 1.1. Noto Serif Tangut draws
  every character this face does and more, so the site serves only a complement subset of the
  characters Noto lacks (`BabelStoneTangut-complement.woff2`): the components and the newest
  ideographs. The full font is in this directory for rebuilding that subset.

Rebuild the Noto supplement and the BabelStone complement with `bun run build:tangut-fonts`.

- **New Tangut Std** (新西夏字體), from the 古今文字集成 font page (ccamc.org/fonts_tangut.php),
  where it is offered for download alongside Noto Serif Tangut; it is described there as built
  from 文海, 同音 and 同義 with the script's structures corrected. No licence text ships with the
  archive; the font is served for this personal tool. `NewTangutStd-complement.woff2` draws the
  Tangut components with Noto Serif Tangut, which this face leaves out.
