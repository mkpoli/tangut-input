// The works the surname, office and place lists cite, by the key `data/tangut-names.tsv` uses. West's
// geography post and two family posts are the published part; the tweets are his reading of dictionary
// entries, quoted where a study is not at hand.
export const NAME_SOURCES = {
  babelstone2013: {
    author: 'Andrew West',
    title: 'A Fragment of Tangut Geography',
    where: 'BabelStone Blog, 10 April 2013',
    note: 'Reads Or. 12380/2249, a fragment of the 天盛律令 printed as plate XXVI (a) in Grinstead 1961, and adds the place names it can identify. Readings are Li Fanwen 2008; the Chinese and modern locations are West\'s identifications.',
    url: 'https://www.babelstone.co.uk/Blog/2013/04/fragment-of-tangut-geography.html',
  },
  babelstone2015: {
    author: 'Andrew West',
    title: 'Two Tangut Families Part 2 : Xiaoli Qianbu',
    where: 'BabelStone Blog, 29 January 2015',
    note: 'Gives the Tangut of the Daming stele and the reading of 嵬名 after Jacques 2010. Readings on its Tangut table are Sofronov\'s, as printed in Kychanov 2006.',
    url: 'https://www.babelstone.co.uk/Blog/2015/01/two-tangut-families-part-2.html',
  },
  tangutsea20200506: {
    author: 'Andrew West (@TangutSea)',
    title: '𗃛, a family name',
    where: 'Sea of Tangut Characters archive, 6 May 2020',
    note: 'A thread of three posts. It reads the dictionary entry and gives the person 𗃛𗣼𗋿 梁德養; a tweet, not a study.',
    url: 'https://babelstone.co.uk/TangutSea/1258048915007569920.html',
  },
  tangutsea20200512: {
    author: 'Andrew West (@TangutSea)',
    title: '𗼆 and 𗼣, clan names',
    where: 'Sea of Tangut Characters archive, 12 May 2020',
    note: 'A thread of four posts on the characters derived from 𗙴. A tweet, not a study.',
    url: 'https://babelstone.co.uk/TangutSea/1260265276320464898.html',
  },
  tangutsea20200516: {
    author: 'Andrew West (@TangutSea)',
    title: '𘝻, a family name',
    where: 'Sea of Tangut Characters archive, 16 May 2020',
    note: 'A tweet, not a study; it quotes the dictionary.',
    url: 'https://babelstone.co.uk/TangutSea/1261791063334928384.html',
  },
  tangutsea20200522: {
    author: 'Andrew West (@TangutSea)',
    title: '𗱏 transcribing the surname 卜',
    where: 'Sea of Tangut Characters archive, 22 May 2020',
    note: 'A tweet, not a study.',
    url: 'https://babelstone.co.uk/TangutSea/1263624241670426625.html',
  },
  tangutsea20200602: {
    author: 'Andrew West (@TangutSea)',
    title: 'Four family names in Mixed Characters',
    where: 'Sea of Tangut Characters archive, 2 June 2020',
    note: 'Quotes four consecutive names in 雜字, Or. 12380/1843 (L). A tweet, not a study; the photograph it posts is the evidence.',
    url: 'https://babelstone.co.uk/TangutSea/1267611408872755200.html',
  },
  tangutsea20200622: {
    author: 'Andrew West (@TangutSea)',
    title: '𗫲, a family name',
    where: 'Sea of Tangut Characters archive, 22 June 2020',
    note: 'A tweet, not a study; it quotes the dictionary.',
    url: 'https://babelstone.co.uk/TangutSea/1274995548962074624.html',
  },
  tangutsea20200701: {
    author: 'Andrew West (@TangutSea)',
    title: '𘑼, a family name',
    where: 'Sea of Tangut Characters archive, 1 July 2020',
    note: 'A tweet, not a study; it quotes the dictionary.',
    url: 'https://babelstone.co.uk/TangutSea/1278420966587105282.html',
  },
  'zhwiki-weiming': {
    author: 'Chinese Wikipedia contributors',
    title: '嵬名氏',
    where: 'Chinese Wikipedia, revision 75069134, read 7 November 2026',
    note: 'CC BY-SA 4.0. Gives 𗼨𗆟 after 李範文《夏漢字典》 p. 444 and 𗨻𗆟 after p. 424; the dictionary itself was not seen.',
    url: 'https://zh.wikipedia.org/w/index.php?oldid=75069134',
  },
}

/** The sources' order in the page's numbered list. */
export const NAME_SOURCE_ORDER = /** @type {(keyof typeof NAME_SOURCES)[]} */ ([
  'babelstone2013', 'babelstone2015', 'tangutsea20200506', 'tangutsea20200512', 'tangutsea20200516',
  'tangutsea20200522', 'tangutsea20200602', 'tangutsea20200622', 'tangutsea20200701', 'zhwiki-weiming',
])
