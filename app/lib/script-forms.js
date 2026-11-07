// The script forms the site records, outside the regular script: where a character stands in a
// photographed or drawn source, the crop of it, and the source the crop comes from. A character can
// stand in more than one source, so each character keeps a list.
import FORMS from '../data/tangut-script-forms.json' with { type: 'json' }

/** @typedef {{ id: string, title: string, titleZh?: string, author: string, url: string, licence: string,
 *   licenceUrl: string, basedOn?: string, retrieved: string, note?: string }} ScriptSource */
/** @typedef {{ char: string, script: string, source: string, image: string, position: number,
 *   index?: string, width: number, height: number }} ScriptForm */

/** @type {ScriptSource[]} */
export const SCRIPT_SOURCES = FORMS.sources
/** @type {ScriptForm[]} */
export const SCRIPT_FORMS = FORMS.forms

/** @type {Map<string, ScriptSource>} */
const sources = new Map(SCRIPT_SOURCES.map(source => [source.id, source]))
/** @type {Map<string, ScriptForm[]>} */
const byChar = new Map()
for (const form of SCRIPT_FORMS) {
  const list = byChar.get(form.char)
  if (list) list.push(form)
  else byChar.set(form.char, [form])
}

/** The recorded forms of a character, in the order the data gives them. @param {string} char */
export const scriptForms = char => byChar.get(char) ?? []
/** The source a form was cut from. @param {ScriptForm} form */
export const sourceOf = form => /** @type {ScriptSource} */ (sources.get(form.source))
