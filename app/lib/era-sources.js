// The works the era list cites, by the key `data/tangut-era-evidence.tsv` uses. `calendar` is the
// source of every era's dates and of the forms no other source backs.
export const ERA_SOURCES = {
  calendar: {
    author: 'Andrew West',
    title: 'Western Xia calendar (XixiaCalendar.txt)',
    publisher: 'BabelStone',
    year: '2023',
    note: 'the dates of every era and most Tangut forms; no source is given for the forms',
    url: 'https://www.babelstone.co.uk/Calendar/XixiaCalendar_txt.zip',
  },
  west2007: {
    author: 'Andrew West',
    title: 'Tangut Coins',
    publisher: 'BabelStone Blog',
    year: '2007',
    note: 'readings of the coins, with the earlier readings of Luo Fuchang, Chen Bingying and Zhao Quanzhi',
    url: 'https://babelstone.co.uk/Blog/2007/01/tangut-coins.html',
  },
  west2020: {
    author: 'Andrew West (@TangutSea)',
    title: 'Post of 1 May 2020 on 𗓆',
    publisher: 'Sea of Tangut Characters archive',
    year: '2020',
    note: 'the title of the 天盛改舊新定律令 in Tangut',
    url: 'https://babelstone.co.uk/TangutSea/1256183861173784576.html',
  },
  nie2004: {
    author: '聶鴻音',
    title: '西夏文《過去莊嚴劫千佛名經》發願文中的兩個年號',
    publisher: '固原師專學報 2004(5), p. 12',
    year: '2004',
    note: 'read as quoted by 公維章, 西夏學 2020(1), p. 300; the article itself was not seen',
    url: 'https://www.sinoss.net/upload/resources/file/2023/04/12/31528.pdf',
  },
}

/** The order the list at the foot numbers them in. */
export const ERA_SOURCE_ORDER = /** @type {(keyof typeof ERA_SOURCES)[]} */ (['calendar', 'west2007', 'west2020', 'nie2004'])
