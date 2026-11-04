// How a Tibetan gloss is shown: the script as the manuscript writes it, with a dotted circle under a
// lone vowel sign and a ? where the Wylie has a letter that could not be read, and the manuscripts
// it stands in with a count for each.

/** @param {string} wylie @param {string} script */
export const tibetanShown = (wylie, script) => `${/^\p{M}/u.test(script) ? '◌' : ''}${script}${wylie.includes('[?]') ? '?' : ''}`

/** @param {[string, number][]} where */
export const tibetanWhere = where => where.map(([shelf, count]) => `${shelf} ×${count}`).join(', ')

/** A gloss's hover text: its Wylie, and each manuscript it is written in with how often.
 *  @param {string} wylie @param {[string, number][]} where */
export const tibetanTitle = (wylie, where) => `${wylie} · ${tibetanWhere(where)}`
