// The works the era list cites, by the key `data/tangut-era-evidence.tsv` uses. `calendar` is the
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
export const ERA_SOURCE_ORDER = /** @type {(keyof typeof ERA_SOURCES)[]} */ (['calendar', 'west2007', 'west2020', 'nie2004', 'gong2020'])
