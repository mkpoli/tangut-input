# Books

The works the site reads for 音（李范文）with its fanqie and 直音, 音（聂历山）, 藏文對音, the 文海 text and
the Chinese meanings. These fields are keyed from the editions themselves, each row citing the edition
and page it comes from.

`source.yaml` records one work per entry: what it gives, the edition, its rights, and the route the
file came by. `files.tsv` records what is on disk, with the checksum and the resolution of the scan.
The scans are large and stay in `cache/books/`, which is not committed; `scripts/fetch_books.py`
fetches them again and checks each against its recorded md5.

## Why the edition and not a mirror

A mirror of a dictionary is someone else's transcription. Keying from the book keeps the citation to
a page the reader can open, and lets a wrong reading be traced to the printed column it stands in.
The scans carry no Tangut text layer, so every Tangut form is matched by code point and checked by
eye; the readings and glosses are Chinese and Latin script and are keyed, not OCR'd.

## The works

| id | Work | Gives | Scan |
| --- | --- | --- | --- |
| `zhangzhongzhu` | 番漢合時掌中珠, 骨勒茂才, 1190 | the Chinese character written for a Tangut character; the Chinese gloss | two manuscript witnesses at 800 × 1200 px, for comparison only; keyed from the 貽安堂 printing as IIIF canvases at 5766 × 4978 px |
| `xiahan-zidian` | 夏漢字典, 李范文, 中國社會科學出版社, 1997 | Li Fanwen's reading with its fanqie and 直音, and the Chinese meanings | 1056 × 1472 px, no text layer |
| `wenhai-yanjiu` | 文海研究, 史金波・白濱・黃振華, 中國社會科學出版社, 1983 | the 文海's own entries and commentary | 2242 × 3136 px, no text layer |
| `nevsky-1960` | Тангутская филология, Н. А. Невский, Издательство восточной литературы, 1960 | the 音（聂历山）column: Nevsky's readings and glosses | 2580 × 3271 px, two volumes |
| `nevsky-1971` | 西夏語辞書, Н. А. Невский, tr. 西田龍雄, 座右宝刊行会, 1971–1973 | the same dictionary in Japanese, with an index volume | not fetched |
| `arakawa-tsuin` | 西夏語通韻字典, 荒川慎太郎, 1999 | Arakawa's reconstruction, with the fanqie of every entry it holds | 2149 × 3035 px, with a text layer |
| `ghc-2002` | 西夏語文研究論文集, 龔煌城, 中央研究院語言學研究所籌備處, 2002 | his reconstruction, in English papers that work several through the characters 掌中珠 sets over Chinese | 2557 × 3583 px; the OCR layer mangles the Chinese and reads the English |
| `ghc-2005` | 西夏語言文字研究論集, 龔煌城, 民族出版社, 2005 | his Chinese papers, among them the 類林 Tangut–Chinese transcription study | 1184 × 1680 px, bookmarked, with the contents list at the front |

The Tibetan glosses already come from Andrew West's index of the British Library manuscripts, so no
book is needed for that column; the site keeps the index as its source and cites the manuscripts.

## Rights

None of these editions is free to redistribute. The files stay out of the build; what the site
publishes is keyed rows with citations, which is the same footing the other unlicensed sources on
this site stand on. The Commons scans of 掌中珠 are public domain as scans of a public-domain
original; the 貽安堂 photographs under DOI 10.20730/100354804 are CC BY-NC 4.0 and govern the
images, not the keyed rows.

## What is still weak

- The 夏漢字典 scan is 70 ppi. Enough to key Chinese glosses and readings; a Tangut glyph at that
  size is thin. A 超星 or CASS copy at 300 ppi would replace it.
- The 2005 龔煌城 collection is 143 ppi. It is the navigable copy (bookmarks, contents list), and
  the 2002 volume is the sharp one for the same articles; a glyph is read in 2002 and the Chinese
  article text in 2005.
- The Japanese translation of Nevsky, 西夏語辞書 (1971–1973), is not fetched: no copy on libgen and
  none open at the National Diet Library. The Russian original carries the same entries.
- 西夏語通韻字典 prints no publisher or colophon in this copy. 雄山閣出版 is the usual attribution
  and is unverified.

## Re-fetching

```sh
uv run scripts/fetch_books.py --work wenhai-yanjiu    # one work
uv run scripts/fetch_books.py --check                 # verify what is on disk
```

A `libgen:` route holds the md5; the script mints a download key from libgen's ads page, tries the
CDN and then libgen itself. An `ipfs:` route lists content addresses, tried over the gateways in the
script. Both are hashed before a file is kept: a route that answers something else leaves it as
`.bad` and the next route is tried. Paths in `files.tsv` are relative to `cache/books/`, and the check
holds each row's status to the one in `source.yaml`.
