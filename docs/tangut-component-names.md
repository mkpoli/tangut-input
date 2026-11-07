# Japanese shape names for Tangut components

Japanese work on Tangut describes a component by the kana its strokes resemble. The description is
shorthand for a shape: 𘡃 is ノメ and 𘫺 is くノ, and the two are told apart by their strokes (3 and
2). The name describes strokes; the meaning is separate.

| Name | Component | Source |
| --- | --- | --- |
| くノ | 𘫺 U+18AFA | Arakawa 2023, n. 21 |
| ノメ | 𘡃 U+18843 | Arakawa 2023, n. 21 |
| ノノメ | 𘢌 U+1888C | Arakawa 2023, §1.4 |
| ノメメ | 𘤊 U+1890A | Arakawa 2020; Japanese Wikipedia |
| くくノ | 𘫽 U+18AFD | Arakawa 2020; Japanese Wikipedia |
| くノ﹅ | 𘢒 U+18892 | Arakawa 2023, table 4 A1 |
| ノくノ﹅ | 𘤆 U+18906 | Arakawa 2023, table 4 A2 |
| くくノ﹅ | 𘦄 U+18984 | Arakawa 2023, table 4 A4 |
| コくノ﹅ | 𘧆 U+189C6 | Arakawa 2023, table 4 A3 |
| くノ﹅ノメ | 𘧶 U+189F6 | Arakawa 2023, table 4 A5 |
| ノ匕﹅ | 𘢕 U+18895 | Arakawa 2023, table 5 B1 |
| ノノ匕﹅ | 𘤈 U+18908 | Arakawa 2023, table 5 B2 |
| 一匕﹅ | 𘡴 U+18874 | Arakawa 2023, table 5 B3 |
| 二匕﹅ | 𘣒 U+188D2 | Arakawa 2023, table 5 B4 |
| ソ一匕﹅ | 𘦜 U+1899C | Arakawa 2023, table 5 B6 |
| ラ匕﹅ | 𘣭 U+188ED | Arakawa 2023, table 5 B8 |
| コ匕﹅ | 𘤾 U+1893E | Arakawa 2023, table 5 B9 |
| コ一匕﹅ | 𘦺 U+189BA | Arakawa 2023, table 5 B11 |

The hover card takes a component's stroke count from the site's Unicode-derived data, which can
differ from a count in the source.

The same shorthand builds longer descriptions. Arakawa 2018 writes 一ノメ and 一ノノメ for the
elements with a horizontal stroke above, and 一くノ and 一ノくノ for the forms he found in the
Lotus Sutra; Arakawa 2023 adds ノくノ, コくノ, くノメ, くノノメ, コノメ, ソフノメ, ノ匕, ノノ匕,
ソ一匕, フサ二匕 and ラ匕. These describe one element's strokes, often across more than one encoded
component, and they are not a list of names for the 768 Tangut components.

The eighteen rows above are the five base names and the thirteen variants that the cited sources
tie to a code point. They are kept in `data/tangut-component-names.tsv` and merged into
`data/component-names.tsv` by `scripts/build_component_names.py`, so a search for くノ or ノメ
reaches 𘫺 or 𘡃. The site's Find page reads the same eighteen rows from
`app/data/tangut-component-names.json` and shows them in a shape-name group; the Parts filter accepts the names too, and the part card on Parts and the Cangjie
palette shows its name with its code point, component number, strokes, uses and Cangjie codes. Parts
adds an eighteen-row table comparing the names across Japanese, English, Chinese, Russian and Korean. The rest of the vocabulary
is recorded here because the sources read for this note do not assign it to individual code points.

`data/tangut-component-shape-hints.json.gz` is a separate editorial aid: the three nearest attested
names for each of the 768 components, by ink similarity, with scores. It is not a name list. The
method cannot separate くノ from ノメ; use the hints to find rows worth checking against a source.
The part card shows the first hint at 0.70 or above with an agreeing stroke count for a component
with no attested name, labelled unconfirmed.

## Sources

- 荒川慎太郎 2018「西夏文字における、いくつかの左下要素の筆画について」『日本言語学会第157回大会予稿集』442–447. The proceedings are distributed as
  <https://ls-japan.org/modules/documents/LSJpapers/meeting/157/157.zip>.
- 荒川慎太郎 2023「西夏文字における「点」の出現環境と機能」『言語研究』164: 39–66,
  <https://www.jstage.jst.go.jp/article/gengo/164/0/164_39/_article/-char/ja/>.
- 荒川慎太郎 2020「西夏文字の、ある「５画」部首の再分類」日本言語学会第160回大会予稿集,
  <https://ls-japan.jpn.org/modules/documents/LSJpapers/meeting/160/handouts/a/A-3_160.pdf>.
- 日本語版ウィキペディア「西夏文字」, <https://ja.wikipedia.org/wiki/西夏文字>, CC BY-SA 4.0,
  read 2026-11-03.
- ぶんぽ「西夏語訳『入菩提行論』第2章第1節（前編）」, note, 2024-12-30,
  <https://note.com/bunpo10381227/n/ndabe8db663ee>, for the account of ノメメ and くくノ in the
  dictionaries and the 2018 change in stroke counts. A blog, used as a secondary account.
