# Wikisource corpus

`pages.json` is a pinned snapshot of the 46 Tangut text pages in
[Category:𗼇𗟲](https://wikisource.org/wiki/Category:%F0%97%BC%87%F0%97%9F%B2) on Wikisource, read
2026-11-03. It keeps each page's revision id, timestamp, editor and wikitext, so
`scripts/build_tangut_attestation.py` can rebuild the same corpus without the network.

The category holds twelve texts:

| Root page | Text | Pages |
| --- | --- | ---: |
| `𗢳𗗚𗵃𘟙𗗙𗹙𘟩𘒣𗖰𗚩` | Question asked by the Dragon King of the Sea | 1 |
| `𗣛𘟙𗯨𗙏𘝯𗖰𗚩` | High King Avalokitesvara Sutra | 1 |
| `𗵒𘗁𘄒𘎑𘏞𗓽𗕥𗸰𗖰𗚩` | Diamond Sutra | 33 |
| `𗹌𘐘𗍫𗰗𗏁𗤄𗊬` | Newly-carved Twenty-five Questions and Answers | 1 |
| `𗼃𘝯𘝵𗦳𘜶𗈁𗤶𗄊𗧯𗣩𘉐𗖰𗖵𗰖` | Mahākāruṇika-nāma-ārya-avalokiteśvara dhāraṇī | 1 |
| `𘚜𗼃𗰜𗡙𗨮` | Hymn of the Holy Origin of Tanguts | 1 |
| `𗵒𗭭𘃎𘐏𘝞` | Newly Collected Grains of Gold in the Palm of the Hand | 1 |
| `𗼑𗼑𗫉𗊱` | Ode on Monthly Pleasures | 1 |
| `𗴮𘊳` | The Forest of Categories (volumes II–III) | 3 |
| `𗴂𗹭𗂧𘜶𘍞𗃛𗉔𗿣𗿷𗽔𘗣𗗙𘐆𘝞` | Record of the Spiritual Pagoda at Liángzhōu | 1 |
| `𗆧𗰖𗬻𘜼𘋥𘝿` | Newly Assembled Precious Dual Maxims | 1 |
| `𗙏𘙰𗫸𘜏𘁨` | Preface to the Revised Tongyin | 1 |

The root page's header carries the English title, the manuscript or edition, and the transcription's
basis; its `==Sources==` section carries the printed bibliography. The build keeps the header note
and the page revision, and drops the bibliographies, template markup, images, links and the Sanskrit
reference lines. The running text is whatever the page puts inside `{{Tangut|…}}` templates, with
refs and `small` markup removed. A page's section comments (`Question 1`, `Mantra for…`) become line
sections.

## Rights

Wikisource text is [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The attribution
is to Wikisource contributors, with the page and revision id. The underlying editions are cited in
each page's header and sources, and are not reproduced here. `app/data/tangut-attestation.json.gz`
mixes this text with the CC BY 4.0 facsimile corpus; its sources each carry their own licence.

## Refreshing

```sh
python3 scripts/fetch_tangut_wikisource.py
python3 scripts/build_tangut_attestation.py
```

The fetch script records the current revisions and read date. A rebuild after a wiki edit changes
the revision ids, line labels and counts, so run the data tests and look at the source list before
committing.
