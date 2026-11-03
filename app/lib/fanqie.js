// The Chinese fanqie the sound glosses record. Li Fanwen's gloss for a character reads like
// 「正齒音，奢餘切，音叔」: the initial's class, the two characters that spell it, and the 直音 — the
// Chinese character the Tangut one sounds like. Nevsky's gloss gives a sound without the spelling.

/** @typedef {{ char: string, upper: string, lower: string, zhiyin: string, round: boolean }} HanFanqie */

/**
 * The two characters of a spelling, with an optional 合 or 開 between them: the glosses write
 * 「底合卒切」 for 底's rounded reading, where 合 marks the rounding and is not a character of the
 * spelling. Read without that, the spelling came out as 合卒.
 */
const SPELLING = /([\u4e00-\u9fff])[（(]?[）)]?([合開])?[（(]?[）)]?([\u4e00-\u9fff])切/
/** 音X, dropping any parenthesised alternative. */
const SOUND = /[，,]\s*音([^，,。]+)/

/**
 * Every character whose Chinese gloss spells it with a fanqie.
 * @param {{ char: string, pronunciations?: Record<string, string> }[]} entries
 * @returns {HanFanqie[]}
 */
export function hanFanqie(entries) {
  /** @type {HanFanqie[]} */
  const found = []
  for (const entry of entries) {
    const text = entry.pronunciations?.sound_li_fanwen ?? ''
    const spelling = SPELLING.exec(text)
    if (!spelling) continue
    const sound = SOUND.exec(text)?.[1]?.replace(/[（(].*?[)）]/g, '').replace(/[合開]$/, '').trim() ?? ''
    const round = spelling[2] === '合'
    found.push({ char: entry.char, upper: spelling[1], lower: spelling[3], zhiyin: sound, round })
  }
  return found
}

/**
 * The spellings recorded for each 直音: one sound, however many ways it is written.
 * @param {HanFanqie[]} records
 * @returns {Map<string, { chars: string[], spellings: Set<string> }>}
 */
export function sounds(records) {
  /** @type {Map<string, { chars: string[], spellings: Set<string> }>} */
  const by = new Map()
  for (const record of records) {
    if (!record.zhiyin) continue
    const group = by.get(record.zhiyin) ?? { chars: [], spellings: new Set() }
    by.set(record.zhiyin, group)
    group.chars.push(record.char)
    group.spellings.add(record.upper + (record.round ? '合' : '') + record.lower)
  }
  return by
}
