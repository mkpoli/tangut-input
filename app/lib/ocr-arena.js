// The Tangut OCR attempts the site knows about, and the one sample it can still measure.
//
// A reported score is the author's own, on the author's own set. The sets differ in script, size and
// task, so the rows are a history, not a ranking. The measured runs all use the same 24 signs; they
// live in `benchmark/ocr/sample.json`.
import SAMPLE from '../../benchmark/ocr/sample.json' with { type: 'json' }

export const LAST_CHECKED = '2026-11-17'

/** @typedef {'Character' | 'Line' | 'Page'} Scope */

/**
 * @typedef {object} Attempt
 * @property {number} year
 * @property {string} name
 * @property {string} by
 * @property {Scope} scope
 * @property {string} method
 * @property {string | null} score
 * @property {string} scoreNote
 * @property {string} terms
 * @property {string} url
 * @property {boolean} [code]
 * @property {boolean} [weights]
 * @property {boolean} [demo]
 */

/** @type {Attempt[]} */
export const ATTEMPTS = [
  {
    year: 2011,
    name: 'Elastic mesh',
    by: 'Guangfu Men, Chen Pan, Changqing Liu · 中文信息学报',
    scope: 'Character',
    method: 'Directional elastic mesh over thinned scans, LDA',
    score: '87.99%',
    scoreNote: '240 classes, 9,600 samples, 4-fold',
    terms: 'No open licence · no code',
    url: 'https://oversea.cnki.net/kcms/detail/detail.aspx?dbcode=CJFD&filename=MESS201105017',
  },
  {
    year: 2012,
    name: 'Threshold and PCA',
    by: 'Changqing Liu · Physics Procedia 33',
    scope: 'Character',
    method: 'Global threshold, scanned segmentation, principal components',
    score: null,
    scoreNote: 'No figure in the abstract',
    terms: 'Paper CC BY-NC-ND · no code',
    url: 'https://doi.org/10.1016/j.phpro.2012.05.201',
  },
  {
    year: 2017,
    name: 'DCNN',
    by: 'Guangwei Zhang, Xiaomang Han · ICSAI 2017',
    scope: 'Character',
    method: 'Deep CNN, 100,000+ labelled images',
    score: '>94%',
    scoreNote: 'validation accuracy',
    terms: 'Paper © IEEE · no code',
    url: 'https://doi.org/10.1109/icsai.2017.8248332',
  },
  {
    year: 2018,
    name: 'TangutOCR',
    by: 'LazyGuitar · GitHub',
    scope: 'Character',
    method: 'MLP, CNN and IRNN experiments; CharSample data',
    score: null,
    scoreNote: 'No README or result',
    terms: 'No licence',
    url: 'https://github.com/LazyGuitar/TangutOCR',
    code: true,
  },
  {
    year: 2019,
    name: 'Target-Directed MixUp',
    by: 'Guangwei Zhang, Yinliang Zhao · ICDAR 2019',
    scope: 'Character',
    method: 'MixUp between labelled and target glyphs, few-shot labelling',
    score: '80%',
    scoreNote: 'unseen classes, 4–5 examples',
    terms: 'Paper © IEEE · no code',
    url: 'https://doi.org/10.1109/icdar.2019.00041',
  },
  {
    year: 2022,
    name: 'TCRNet / STCRNet',
    by: 'Jinlin Ma et al. · IET Image Processing',
    scope: 'Character',
    method: 'TCD and TCD-E, 6,077 classes; CNN with a centre-loss term',
    score: '97.96%',
    scoreNote: 'TCD-E; +0.70 on the similar set',
    terms: 'Paper CC BY-NC-ND · TCD not public',
    url: 'https://doi.org/10.1049/ipr2.12471',
  },
  {
    year: 2023,
    name: 'DCT-DSCNN',
    by: 'Agi Prasetiadi et al. · Journal of Dinda',
    scope: 'Character',
    method: 'Depthwise separable CNN, DCT preprocessing; Noto Serif renderings',
    score: '~90%',
    scoreNote: '6,136 classes, synthetic test',
    terms: 'Paper CC BY-SA 4.0 · no code',
    url: 'https://doi.org/10.20895/dinda.v3i2.1106',
  },
  {
    year: 2024,
    name: 'A-CapsNet',
    by: 'Lijuan Yang et al. · 计算机应用与软件',
    scope: 'Character',
    method: 'AlexNet features into capsule layers',
    score: '94%',
    scoreNote: '3 points over CapsNet',
    terms: 'Paper © journal · no code',
    url: 'https://doi.org/10.3969/j.issn.1000-386x.2024.08.031',
  },
  {
    year: 2025,
    name: 'Font-generated OCR',
    by: 'Yuxi Zheng, Ziming Zhou et al. · 数字人文, 2025',
    scope: 'Character',
    method: 'MX-Font-style generation, 101 styles, ViT/EVA-02',
    score: '83.1%',
    scoreNote: '500 real images; 6,125 characters',
    terms: 'Paper · no OCR code',
    url: 'https://mp.weixin.qq.com/s/p1QuhlWkE7KUD7uPI9rHYA',
  },
  {
    year: 2025,
    name: 'Small-sample model',
    by: 'Xinyi Zhao, Wei Shi, Guomin Li · 宁夏大学学报',
    scope: 'Character',
    method: 'Transfer learning and augmentation; YOLOv8-VNeXt proposal',
    score: '+5.65%',
    scoreNote: 'mean gain; 667 annotated characters',
    terms: 'Paper © journal · no code',
    url: 'https://opaj.napstic.cn/periodicalArticle/0120250702992988',
  },
  {
    year: 2025,
    name: 'Tangut-Book OCR',
    by: 'Xinyi Zhao · Ningxia University MA',
    scope: 'Line',
    method: 'DDPM-Tangut augmentation, YOLO11-Tangut, SVTR-Tangut',
    score: null,
    scoreNote: 'Reported gains, no single figure in the abstract',
    terms: 'Thesis © author · no code',
    url: 'https://cnki.sris.com.tw/KCMS/detail/detail.aspx?filename=1025417294.nh&dbcode=CMFD&dbname=CMFD2025',
  },
  {
    year: 2025,
    name: 'THOCR',
    by: 'botsumizu · GitHub',
    scope: 'Character',
    method: 'ResNet-18 structure classifier, four recognizers, 170 classes',
    score: '96%',
    scoreNote: '50 test samples',
    terms: 'No licence',
    url: 'https://github.com/botsumizu/TangutHierarchicalOCR',
    code: true,
    weights: true,
  },
  {
    year: 2026,
    name: 'CASS-Tangut',
    by: 'Siyuan Xue et al. · GitHub',
    scope: 'Character',
    method: '6,212 classes; ResNet, DenseNet, EfficientNet, ConvNeXt',
    score: null,
    scoreNote: 'Benchmark code, no result',
    terms: 'No licence · data restricted',
    url: 'https://github.com/ancient-digital-platform/CASS_Tangut',
    code: true,
  },
  {
    year: 2026,
    name: 'TangutLines',
    by: 'Chia-Wei Lin · PACLIC 2026',
    scope: 'Line',
    method: 'CRNN-CTC and SVTR-CTC on synthetic and manuscript lines',
    score: 'CER 10.88%',
    scoreNote: 'SVTR; exact 48.69%, 7,800 synthetic',
    terms: 'No licence · no checkpoints',
    url: 'https://github.com/chiaweilinunil/tangutlines',
    code: true,
  },
  {
    year: 2026,
    name: 'SPMTNet',
    by: 'Xueyan Wang et al. · npj Heritage Science',
    scope: 'Character',
    method: 'Component and spatial priors; XiXiaDB and CharSample',
    score: null,
    scoreNote: 'Outperforms baselines; no single figure in the abstract',
    terms: 'Paper CC BY-NC-ND · no code',
    url: 'https://doi.org/10.1038/s40494-026-03012-6',
  },
  {
    year: 2026,
    name: 'tangut-mixocr v1',
    by: 'Zhengshi Jiang · GitHub',
    scope: 'Line',
    method: '5.7M CNN-BiLSTM-CTC, 14,666 characters',
    score: '98.9%',
    scoreNote: '874 Tangut chars; 99.5% headwords',
    terms: 'MIT',
    url: 'https://github.com/FlagRain/tangut-mixocr',
    code: true,
    weights: true,
    demo: true,
  },
  {
    year: 2026,
    name: 'Tangut digital platform',
    by: 'CASS Institute of Linguistics',
    scope: 'Page',
    method: 'OCR, collation, translation and nine corpora',
    score: null,
    scoreNote: 'No public figure',
    terms: 'Closed · no terms',
    url: 'http://ling.cass.cn/keyan/xueshuchengguo/szzy/202610/t20261021_6074303.html',
  },
]

/** @param {'mixocr' | 'band' | 'tesseract'} key */
const right = key => SAMPLE.filter(row => row[key] === row.char).length

/**
 * The same 24 signs, read three ways. `key` names the column in `sample.json` that holds the
 * reading, so a rerun that updates the sample updates these counts.
 */
export const MEASURED = [
  {
    name: 'Tesseract 5.5.2',
    note: 'chi_sim, one glyph per crop, --psm 10',
    score: right('tesseract'),
    total: SAMPLE.length,
  },
  {
    name: 'tangut-mixocr v1',
    note: 'one glyph per crop',
    score: right('mixocr'),
    total: SAMPLE.length,
  },
  {
    name: 'Band reader',
    note: 'four glyphs a column, this site',
    score: right('band'),
    total: SAMPLE.length,
    ours: true,
  },
]

/** The six entries of the sample, top to bottom, each with its four signs. */
export const ENTRIES = [2, 6, 10, 14, 18, 22].map(column => SAMPLE.filter(row => row.column === column))
