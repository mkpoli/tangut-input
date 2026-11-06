// Published work on the Gyalrongic languages and their comparison with Tangut, oldest first within
// each group; undated resources close their group. `kind` names the work as a reader would look for
// it, so a thesis that is the language's grammar is a grammar. `free` means the link itself reaches
// the full text at no charge. Titles stay in the language of publication, and `gloss` is the English
// title the record behind the link gives. Every entry was checked against that record: Crossref, HAL,
// Glottolog, CiNii or the publisher, as `docs/materials.md` says.

/** @typedef {'article' | 'book' | 'chapter' | 'data' | 'dictionary' | 'grammar' | 'preprint' | 'thesis'} LiteratureKind */
/** @typedef {{ authors: string, year: number | null, title: string, gloss?: string, where: string, kind: LiteratureKind, url: string, free?: boolean }} LiteratureEntry */

/** Other names a reader may search for, as the literature itself writes them. */
export const GROUPS = /** @type {const} */ ([
  { id: 'tangut', names: '' },
  { id: 'rgyalrong', names: 'rGyalrong · Gyalrong · rGyarong · Jiarong · 嘉绒语 · 嘉戎语 · Situ · Japhug · Tshobdun · Zbu' },
  { id: 'khroskyabs', names: 'Khroskyabs · Lavrung · 绰斯甲语 · 拉坞戎语 · Wobzi · Siyuewu · Yelong' },
  { id: 'horpa', names: 'Horpa · Stau · Ergong · Geshiza · 霍尔语 · 霍尔巴语 · 尔龚语 · 道孚语' },
])

/** @type {Record<typeof GROUPS[number]['id'], LiteratureEntry[]>} */
export const LITERATURE = {
  tangut: [
    { authors: 'Guillaume Jacques', year: 2006, title: 'Essai de comparaison des rimes du tangoute et du rgyalrong', where: 'Medieval Tibeto-Burman Languages II (Brill), 121–154', kind: 'chapter', url: 'https://shs.hal.science/halshs-00172304', free: true },
    { authors: 'Guillaume Jacques', year: 2009, title: 'The origin of vowel alternations in the Tangut verb', where: 'Language and Linguistics 10(1), 17–27', kind: 'article', url: 'https://shs.hal.science/halshs-00351738', free: true },
    { authors: 'Guillaume Jacques', year: 2016, title: 'Tangut, Gyalrongic, Kiranti and the nature of person indexation in Sino-Tibetan/Trans-Himalayan', where: 'Linguistics Vanguard 2(1)', kind: 'article', url: 'https://doi.org/10.1515/lingvan-2015-0033' },
    { authors: 'Yunfan Lai, Xun Gong, Jesse P. Gates and Guillaume Jacques', year: 2020, title: 'Tangut as a West Gyalrongic language', where: 'Folia Linguistica 54(s41–s1), 171–203', kind: 'article', url: 'https://doi.org/10.1515/flih-2020-0006' },
    { authors: 'Mathieu Beaudouin', year: 2023, title: 'Tangut and Horpa languages: Some shared morphosyntactic features', where: 'Language and Linguistics 24(4), 611–673', kind: 'article', url: 'https://hal.science/hal-03893868', free: true },
    { authors: 'Yunfan Lai', year: 2023, title: 'Lenition alternation in West Gyalrongic and its implications for Southeast Asian panchronic phonology', where: 'Diachronica 40(3), 341–383', kind: 'article', url: 'https://doi.org/10.1075/dia.21016.lai' },
    { authors: 'Mathieu Beaudouin', year: 2025, title: 'The Tangut verbal template from a cross-West Gyalrongic perspective', where: 'Bulletin of the School of Oriental and African Studies 88(2), 347–357', kind: 'article', url: 'https://doi.org/10.1017/s0041977x24000636' },
    { authors: 'James J. Engels and Tim Bodt', year: 2025, title: 'Songlin and Chamdoic as West Gyalrongic Languages and a Modest Proposal for Tangutic', where: 'Preprint, HAL', kind: 'preprint', url: 'https://hal.science/hal-05374446', free: true },
    { authors: 'Sami P. Honkasalo, Jesse P. Gates and Mathieu Beaudouin', year: 2025, title: 'Preinitials and their development in Horpa and Tangut', where: 'Cahiers de Linguistique Asie Orientale 55(1), 44–87', kind: 'article', url: 'https://doi.org/10.1163/19606028-bja10049' },
    { authors: 'Shuya Zhang and Yunfan Lai', year: 2025, title: 'New origins to vowel tensing in Tangut: internal and comparative evidence', where: 'Bulletin of the School of Oriental and African Studies 88(1), 103–122', kind: 'article', url: 'https://doi.org/10.1017/S0041977X24000673', free: true },
    { authors: 'Yunfan Lai and Shuya Zhang', year: 2026, title: 'Shared innovations and the “Tangut-Horpa clade”: a demonstration of Neogrammarian principles in language classification', where: 'Bulletin of the School of Oriental and African Studies 89(1), 163–191', kind: 'article', url: 'https://hal.science/hal-05064758', free: true },
  ],
  rgyalrong: [
    { authors: 'Yasuhiko Nagano', year: 1984, title: 'A Historical Study of the rGyarong Verb System', where: 'Tokyo: Seishido', kind: 'book', url: 'https://ci.nii.ac.jp/ncid/BA03215051' },
    { authors: 'Lin Xiangrong 林向荣', year: 1993, title: '嘉戎语研究', gloss: 'Research on the rGyalrong language', where: 'Chengdu: Sichuan Minzu Chubanshe', kind: 'book', url: 'https://glottolog.org/resource/reference/id/cldf:lin:93:1' },
    { authors: 'Jackson T.-S. Sun', year: 1994, title: 'Caodeng rGyalrong phonology: a first look', where: 'Linguistics of the Tibeto-Burman Area 17(2)', kind: 'article', url: 'https://doi.org/10.32655/ltba.17.2.02' },
    { authors: 'Huang Liangrong 黃良榮 and Sun Hongkai 孫宏開', year: 2002, title: '漢嘉戎詞典', where: 'Beijing: Minzu Chubanshe', kind: 'dictionary', url: 'https://glottolog.org/resource/reference/id/gj:huangsun02' },
    { authors: 'Guillaume Jacques 向柏霖', year: 2008, title: '嘉绒语研究', gloss: 'Study on the Rgyalrong language', where: 'Beijing: Minzu Chubanshe', kind: 'book', url: 'https://glottolog.org/resource/reference/id/gj:jacques08' },
    { authors: 'Marielle Prins and Yasuhiko Nagano', year: 2009, title: 'A lexicon of the rGyalrong bTsanlha dialect: rGyalrong-Chinese-Tibetan-English', where: 'Senri Ethnological Reports 79. Osaka: National Museum of Ethnology', kind: 'dictionary', url: 'https://glottolog.org/resource/reference/id/318688' },
    { authors: 'Yasuhiko Nagano and Marielle Prins', year: 2013, title: 'rGyalrongic Languages Database', where: 'Osaka: National Museum of Ethnology', kind: 'data', url: 'https://htq.minpaku.ac.jp/databases/rGyalrong/', free: true },
    { authors: 'Xun Gong', year: 2014, title: 'The Personal Agreement System of Zbu Rgyalrong (Ngyaltsu Variety)', where: 'Transactions of the Philological Society 112(1), 44–60', kind: 'article', url: 'https://doi.org/10.1111/1467-968x.12007' },
    { authors: 'Guillaume Jacques', year: 2016, title: 'Dictionnaire Japhug-chinois-français, version 1.1', where: 'HAL', kind: 'dictionary', url: 'https://shs.hal.science/halshs-01244860', free: true },
    { authors: 'Marielle Prins', year: 2016, title: 'A Grammar of rGyalrong, Jiǎomùzú (Kyom-kyo) Dialects', where: 'Leiden: Brill', kind: 'grammar', url: 'https://doi.org/10.1163/9789004325630' },
    { authors: 'Xun Gong', year: 2018, title: 'Le rgyalrong zbu, une langue tibéto-birmane de Chine du Sud-ouest. Une étude descriptive, typologique et comparative', where: 'PhD thesis, Université Sorbonne Paris Cité', kind: 'thesis', url: 'https://shs.hal.science/tel-01894726', free: true },
    { authors: 'Yasuhiko Nagano 長野泰彦', year: 2018, title: '嘉戎語文法研究', gloss: 'A Reference Grammar of the rGyalrong Language – Bhola Dialect', where: 'Tokyo: Kyuko Shoin', kind: 'grammar', url: 'https://ci.nii.ac.jp/ncid/BB27055070' },
    { authors: 'Shuya Zhang', year: 2020, title: 'Le rgyalrong situ de Brag-bar et sa contribution à la typologie de l’expression des relations spatiales : l’orientation et le mouvement associé', where: 'PhD thesis, INALCO', kind: 'thesis', url: 'https://theses.hal.science/tel-03176380', free: true },
    { authors: 'Guillaume Jacques', year: 2025, title: 'A grammar of Japhug, second edition', where: 'Berlin: Language Science Press', kind: 'grammar', url: 'https://langsci-press.org/catalog/book/549', free: true },
    { authors: 'Shuya Zhang', year: 2026, title: '再谈《嘉绒译语》的音系创新与方言归属', gloss: 'Revisiting the phonological innovations and dialectal affiliation of Jiarong yiyu', where: '中国语文', kind: 'article', url: 'https://hal.science/hal-05709670', free: true },
    { authors: 'Shuya Zhang and Ruiyao Li', year: 2026, title: 'Towards a new dialectology of Situ Gyalrong', where: 'Language and Linguistics 27(4), 735–775', kind: 'article', url: 'https://doi.org/10.1075/lali.00269.zha', free: true },
    { authors: 'Pangloss Collection (CNRS)', year: null, title: 'Japhug corpus', where: 'Recordings with transcriptions', kind: 'data', url: 'https://pangloss.cnrs.fr/corpus/Japhug?lang=en', free: true },
  ],
  khroskyabs: [
    { authors: 'Jackson T.-S. Sun', year: 2000, title: 'Parallelisms in the Verb Morphology of Sidaba rGyalrong and Lavrung in rGyalrongic', where: 'Language and Linguistics 1(1), 161–190', kind: 'article', url: 'https://glottolog.org/resource/reference/id/305413' },
    { authors: 'Huang Bufan 黄布凡', year: 2007, title: '拉坞戎语研究', where: 'Beijing: Minzu Chubanshe', kind: 'book', url: 'https://ci.nii.ac.jp/ncid/BA86578642' },
    { authors: 'Yin Weibin 尹蔚彬', year: 2007, title: '业隆拉坞戎语研究', gloss: 'A Study of the Yelong Variety of the Lavrung Language', where: 'Beijing: Minzu Chubanshe', kind: 'grammar', url: 'https://glottolog.org/resource/reference/id/323222' },
    { authors: 'Yunfan Lai', year: 2015, title: 'The Person Agreement System of Wobzi Lavrung (Rgyalrongic, Tibeto-Burman)', where: 'Transactions of the Philological Society 113(3), 271–285', kind: 'article', url: 'https://doi.org/10.1111/1467-968x.12051' },
    { authors: 'Yunfan Lai', year: 2016, title: 'Causativisation in Wobzi and other Khroskyabs dialects', where: 'Cahiers de Linguistique Asie Orientale 45(2), 148–175', kind: 'article', url: 'https://hal.science/hal-01423246', free: true },
    { authors: 'Yunfan Lai', year: 2017, title: 'Grammaire du khroskyabs de Wobzi', where: 'PhD thesis, Université Sorbonne Paris Cité', kind: 'grammar', url: 'https://theses.hal.science/tel-01571916', free: true },
    { authors: 'Yunfan Lai', year: 2020, title: 'The historical development of inverse marking in Khroskyabs: evidence from two modern varieties – Siyuewu and Wobzi', where: 'Bulletin of the School of Oriental and African Studies 83(2), 259–281', kind: 'article', url: 'https://doi.org/10.1017/s0041977x2000258x' },
    { authors: 'Yunfan Lai', year: 2021, title: 'Betrayal through obedience: on the history of the unusual inflectional chain in Siyuewu Khroskyabs', where: 'Linguistic Typology 25(1), 79–122', kind: 'article', url: 'https://doi.org/10.1515/lingty-2021-2075' },
    { authors: 'Yunfan Lai', year: 2021, title: 'The complexity and history of verb-stem ablauting patterns in Siyuewu Khroskyabs', where: 'Folia Linguistica 55(1), 75–126', kind: 'article', url: 'https://doi.org/10.1515/flin-2020-2071' },
    { authors: 'Shuya Zhang, Yunfan Lai and Congwei Yang', year: 2026, title: '嘉绒语组植物词汇的历史比较初探——以白湾嘉绒语与斯跃武绰斯甲语为例', where: '民族语文', kind: 'article', url: 'https://hal.science/hal-05486734', free: true },
  ],
  horpa: [
    { authors: 'Duo’erji 多尔吉', year: 1998, title: '道孚语格什扎话研究', gloss: 'A Study of the Geshizha Variety of the Daofu (Horpa) Language', where: 'Beijing: Chinese Tibetology Press', kind: 'grammar', url: 'https://glottolog.org/resource/reference/id/324777' },
    { authors: 'Jackson T.-S. Sun', year: 2000, title: 'Stem Alternations in Puxi Verb Inflection: Toward Validating the rGyalrongic Subgroup in Qiangic', where: 'Language and Linguistics 1(2), 211–232', kind: 'article', url: 'https://lawdata.com.tw/tw/detail.aspx?no=289506' },
    { authors: 'Guillaume Jacques, Anton Antonov, Yunfan Lai and Lobsang Nima', year: 2014, title: 'Person Marking in Stau', where: 'Himalayan Linguistics 13(2)', kind: 'article', url: 'https://doi.org/10.5070/h913224068', free: true },
    { authors: 'Guillaume Jacques, Yunfan Lai, Anton Antonov and Lobsang Nima', year: 2017, title: 'Stau (Ergong, Horpa)', where: 'The Sino-Tibetan Languages, edited by Graham Thurgood and Randy LaPolla, 597–613', kind: 'chapter', url: 'https://shs.hal.science/halshs-01869941', free: true },
    { authors: 'Sami Honkasalo', year: 2019, title: 'A Grammar of Eastern Geshiza: A Culturally Anchored Description', where: 'PhD thesis, University of Helsinki', kind: 'grammar', url: 'https://hdl.handle.net/10138/307585' },
    { authors: 'Jackson T.-S. Sun', year: 2019, title: 'The Ancestry of Horpa: Further Morphological Evidence', where: 'The Ancestry of the Languages and Peoples of China. Journal of Chinese Linguistics Monograph Series 29, 24–43', kind: 'chapter', url: 'https://cup.cuhk.edu.hk/image/catalog/journal/jpreview/JCL_Mono29-24-43.pdf' },
    { authors: 'Tunzhi Sonam Lhundrop, Hiroyuki Suzuki and Gerald Roche', year: 2019, title: 'Language Contact and the Politics of Recognition amongst Tibetans in the People’s Republic of China: The rTa’u-Speaking ‘Horpa’ of Khams', where: 'The Politics of Language Contact in the Himalaya (Open Book Publishers), 17–48', kind: 'chapter', url: 'https://doi.org/10.11647/obp.0169.01', free: true },
    { authors: 'Sami Honkasalo', year: 2020, title: 'Verb classes in Horpa', where: 'Linguistics of the Tibeto-Burman Area 43(2), 255–290', kind: 'article', url: 'https://doi.org/10.1075/ltba.19013.hon' },
    { authors: 'Jesse P. Gates', year: 2021, title: 'A Grammar of Mazur Stau', where: 'PhD thesis, École des hautes études en sciences sociales', kind: 'grammar', url: 'https://theses.fr/2021EHES0054' },
    { authors: 'Sami Honkasalo and Jesse P. Gates', year: 2024, title: 'A pan-dialectal survey of the Horpa preinitial systems', where: 'Himalayan Linguistics 23(3)', kind: 'article', url: 'https://doi.org/10.5070/h9.35225', free: true },
  ],
}
