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
