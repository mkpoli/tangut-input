# 漢字 glosses

Tiles and the reading tool show the first Chinese sense keyed from the editions, then the first Chinese Wiktionary sense, then the commonest contextual word in 類林. The source and full set of senses appear on hover; the character card gives the keyed dictionary, Wiktionary and 類林 records each their own row.

## Coverage

| Record | Characters | Senses |
| --- | ---: | ---: |
| Chinese Wiktionary, accepted | 110 | 152 |
| Already represented in 類林 | 53 | — |
| No 類林 record | 57 | — |
| 類林 | 1,703 | — |
| Combined source records | 1,760 | — |
| Selected labels containing 漢字 | 1,716 | — |

The earlier 類林-only selector showed Chinese-written labels for 1,657 characters. Some 類林 labels are grammatical abbreviations or question marks; two of its characters belong to the Tangut Supplement and fall outside the 6,144 packed dictionary records.

| Character | Chinese Wiktionary | Revision |
| --- | --- | --- |
| 𗀀 | 毒；下毒者；毒死 | [9036839](https://zh.wiktionary.org/w/index.php?title=𗀀&oldid=9036839) |
| 𗀁 | 吸 | [9268345](https://zh.wiktionary.org/w/index.php?title=𗀁&oldid=9268345) |
| 𗼇 | 党項人 | [9578408](https://zh.wiktionary.org/w/index.php?title=𗼇&oldid=9578408) |

## Chinese Wiktionary

Chinese Wiktionary contributors, [2026-11-01 pages-articles dump](https://dumps.wikimedia.org/zhwiktionary/20261101/), retrieved 2026-11-07, under [CC BY-SA 4.0](https://zh.wiktionary.org/w/index.php?title=Wiktionary:%E7%89%88%E6%9D%83%E4%BF%A1%E6%81%AF&oldid=8368252). Wikimedia's [dated checksum list](https://dumps.wikimedia.org/zhwiktionary/20261101/zhwiktionary-20261101-sha1sums.txt) gives SHA1 `bd139bae2c7c9f5fad6d6a347d07296bf9bcabdc` for the compressed XML. The [snapshot](../data/wiktionary/definitions-zh.json.gz) retains original wikitext, revision, timestamp, latest editor and contributor-history URL for every candidate page; the latest editor is one of the authors.

These senses are attested on Wiktionary; the primary dictionaries were not checked. The `txg-ref` template sometimes links Li Fanwen's dictionary numbers to CCAMC, so independence from CCAMC is uncertain. The separately stored CCAMC search index remains excluded from display.

The dump has 237 single-character Tangut pages, of which 119 contain numbered definition lines. The [extractor](../scripts/extract_tangut_chinese.py) accepts plain text and losslessly unwrapped wikilinks; 25 lines containing unresolved markup or a definition request stay in the rejected records. Rebuilding from the checksum-verified dump reproduces the full snapshot.

Three further senses remain in the raw source and rejected records:

| Character | Source text | Issue |
| --- | --- | --- |
| [𘆽](https://zh.wiktionary.org/w/index.php?title=𘆽&oldid=9211756) | 龍 | The page categorizes the character as 馬 and gives 午 as another sense; the animal gloss is uncertain. |
| [𗗻](https://zh.wiktionary.org/w/index.php?title=𗗻&oldid=7454621) | 壬，地支的第十一位 | 壬 belongs to the heavenly stems; the statement conflicts with the earthly-branch sequence. |
| [𗵊](https://zh.wiktionary.org/w/index.php?title=𗵊&oldid=9211753) | 丑，地支的第五位 | 丑 is the second earthly branch. |

## 類林

Guillaume Jacques, [Leilin database](https://www.academia.edu/25078937/Leilin_database), via [tinbreaker/tangut-text at commit 820fe592](https://github.com/tinbreaker/tangut-text/tree/820fe592c8c0b1512867c70e5c84395a042667f3). Its words describe occurrences in one text, include grammatical labels and can differ from dictionary senses. No licence is stated; its existing use rests on the project owner's permission decision.

## Other sources examined

| Source | Record and limitation |
| --- | --- |
| 骨勒茂才, 《番漢合時掌中珠》 (1190), [甲本 scan](https://commons.wikimedia.org/wiki/File:番漢合時掌中珠_甲本.pdf) and [甲乙本 scan](https://commons.wikimedia.org/wiki/File:番漢合時掌中珠_甲乙本.pdf), Wikimedia Commons, examined 2026-11-07 | Commons marks the original scans public domain. They give Tangut, Chinese transcription and Chinese glosses; no machine-readable Unicode transcription was located, and the Tangut glyphs were not mapped here. |
| Richard Cook, [UniTangut draft](https://www.unicode.org/L2/L2007/07290-tr43-draft.html) (2007), [Berkeley index](https://linguistics.berkeley.edu/~rscook/UTC/Tangut/), examined 2026-11-07 | Describes 1,469 `tLFW1997GlossChi` records attributed to Li Fanwen (1997). The linked [table](https://linguistics.berkeley.edu/~rscook/cgi/UniTangut.txt) returned HTTP 403; the proposed code points differ from modern Unicode, and reuse terms for this table could not be verified. |
| tinbreaker, [Tangut Script Annotation Tool](https://github.com/tinbreaker/Tangut-Script-Annotation-Tool), examined 2026-11-07 | Its README credits CCAMC for data. The code licence does not establish the rights of the underlying glosses; it supplies no independently verified lexical source for this import. |
| [Tangut Learner](https://tangut-learner.com/), examined 2026-11-07 | Displays Chinese glosses and names modern dictionaries. No open data licence was located. |
