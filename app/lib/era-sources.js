// The works the era and title lists cite, by the key `data/tangut-era-evidence.tsv` uses. `calendar` is the
// source of every era's dates and of the forms no other source backs. A work read only through
// another's quotation has no link of its own; its note names the work that quotes it.
export const ERA_SOURCES = {
  calendar: {
    author: 'Andrew West',
    title: 'Western Xia calendar (XixiaCalendar.txt)',
    where: 'BabelStone, 2023',
    note: 'The dates of every era and most Tangut forms; no source is given for the forms.',
    url: 'https://www.babelstone.co.uk/Calendar/XixiaCalendar_txt.zip',
  },
  west2007: {
    author: 'Andrew West',
    title: 'Tangut Coins',
    where: 'BabelStone Blog, 2007',
    note: 'Readings of the coins, with the earlier readings of Luo Fuchang, Chen Bingying and Zhao Quanzhi.',
    url: 'https://babelstone.co.uk/Blog/2007/01/tangut-coins.html',
  },
  west2020: {
    author: 'Andrew West (@TangutSea)',
    title: 'Reply of 1 May 2020 giving the title of the 天盛改舊新定律令 in Tangut',
    where: 'Sea of Tangut Characters archive, 2020',
    note: '',
    url: 'https://babelstone.co.uk/TangutSea/1256183861173784576.html',
  },
  stele1094: {
    author: 'Liangzhou stele (1094), transcribed on Wikisource after Nishida Tatsuo',
    title: '𗴂𗹭𗂧𘜶𘍞𗃛𗉔𗿣𗿷𗽔𘗣𗗙𘐆𘝞',
    where: 'Wikisource, revision 909760; Nishida, 西夏語の研究 I (1964), pp. 156–176',
    note: 'Dates by 大安 2 and 8, 天安禮定 2 and 天祐民安 4 and 5. Its 天安禮定 is at odds with Nie 2004 as quoted, and the two are left side by side here.',
    url: 'https://wikisource.org/w/index.php?oldid=909760',
  },
  months1185: {
    author: 'Ode on Monthly Pleasures, transcribed on Wikisource after Nishida Tatsuo',
    title: '𗼑𗼑𗫉𗊱',
    where: 'Wikisource, revision 1186555; Nishida, 京都大学文学部紀要 25 (1986), pp. 1–116',
    note: 'The colophon is dated 乾祐 16 (1185).',
    url: 'https://wikisource.org/w/index.php?oldid=1186555',
  },
  maxims1187: {
    author: 'Newly Assembled Precious Dual Maxims, transcribed on Wikisource',
    title: '𗆧𗰖𗬻𘜼𘋥𘝿',
    where: 'Wikisource, revision 1021341; Kychanov 1974; 聶鴻音, 西夏學 2 (2007), pp. 134–166',
    note: 'The colophon, transcribed after 聶鴻音 2007, pp. 157–158, names 乾祐 7 (1176) and is dated 乾祐 18 (1187).',
    url: 'https://wikisource.org/w/index.php?oldid=1021341',
  },
  nie2009: {
    author: '聶鴻音',
    title: '乾祐二十年《彌勒上生經御製發願文》的夏漢對勘研究',
    where: '西夏學 4 (2009), pp. 42–45; Tangut text read in the Lausanne Corpus of Digital Tangut Texts',
    note: 'The prayer is dated 乾祐 20 (1189); the Chinese of its title is on p. 43.',
    url: 'https://www.sinoss.net/uploadfile/2010/1130/10732.pdf',
  },
  leilin: {
    author: 'Guillaume Jacques',
    title: 'Leilin database',
    where: 'Tangut 類林; read in the Lausanne Corpus of Digital Tangut Texts',
    note: 'The colophons of two fascicles are dated 乾祐 12 (1181).',
    url: 'https://www.academia.edu/25078937/Leilin_database',
  },
  kychanov2010: {
    author: 'Е. И. Кычанов, tr. 彭向前',
    title: '唐古特譯本《貞觀政要》殘卷考',
    where: '西夏學 6 (2010), pp. 14–18; Tangut text read in the Lausanne Corpus of Digital Tangut Texts',
    note: 'Its Chinese rendering has 貞觀十四年 and 貞觀十七年 at the lines the Tangut opens with 𗣼𘝯, both of the Tang era. The comparison with the coin is made on this page.',
    url: 'https://www.sinoss.net/uploadfile/2012/0606/20120606102539528.pdf',
  },
  diamond: {
    author: 'Diamond Sutra, transcribed on Wikisource',
    title: '𗵒𘗁𘄒𘎑𘏞𗓽𗕥𗸰𗖰𗚩',
    where: 'Wikisource, revision 1030376',
    note: 'The credit line gives the title as the corrector of the text.',
    url: 'https://wikisource.org/w/index.php?oldid=1030376',
  },
  yang2010: {
    author: '楊志高',
    title: '國圖藏西夏文《慈悲道場懺法》卷八譯釋（一）',
    where: '西夏學 5 (2010); Tangut text read in the Lausanne Corpus of Digital Tangut Texts',
    note: 'The translators\' line, and 惠宗 and his mother as the translators.',
    url: 'https://www.sinoss.net/uploadfile/2012/0528/20120528021944100.pdf',
  },
  yang2011: {
    author: '楊志高',
    title: '圖書館藏西夏文《慈悲道場懺法序》譯考',
    where: '西夏學 8 (2011), p. 100',
    note: 'The Chinese of the translators\' line, attributing 惠宗 to 史金波 1988.',
    url: 'https://www.sinoss.net/uploadfile/2012/0620/20120620033537836.pdf',
  },
  cui2007: {
    author: 'Wikipedia contributors, citing 崔紅芬 and 文志勇',
    title: 'Emperor Chongzong of Western Xia',
    where: 'English Wikipedia, accessed 4 November 2026',
    note: 'Its citation is 西夏皇帝尊號考略, 寧夏大學學報 2007(1), whose link is dead; that article was not seen.',
    url: 'https://en.wikipedia.org/wiki/Emperor_Chongzong_of_Western_Xia',
  },
  nie2004: {
    author: '聶鴻音',
    title: '西夏文《過去莊嚴劫千佛名經》發願文中的兩個年號',
    where: '固原師專學報（社會科學版）2004(5), p. 12',
    note: 'Read as quoted by 公維章 2020, p. 301: of the eleven eras from 天授禮法延祚 to 天儀治平, only 大安 had a known Tangut form. The article itself was not seen.',
    url: '',
  },
  gong2020: {
    author: '公維章',
    title: '瓜州榆林窟第19窟甬道西夏「大禮平定四年」題記考辨',
    where: '西夏學 2020(1), pp. 295–304',
    note: '',
    url: 'https://www.sinoss.net/upload/resources/file/2023/04/12/31528.pdf',
  },
}

/** The order the list at the foot numbers them in. */
export const ERA_SOURCE_ORDER = /** @type {(keyof typeof ERA_SOURCES)[]} */ ([
  'calendar', 'west2007', 'west2020', 'stele1094', 'leilin', 'months1185', 'maxims1187', 'nie2009', 'kychanov2010', 'nie2004', 'gong2020', 'diamond', 'yang2010', 'yang2011', 'cui2007',
])
