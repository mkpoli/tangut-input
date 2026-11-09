// The forms one Tangut part is written in: a component with the hook that reaches around the part
// after it, or with the hook alone, stands for the plain component. The table is
// `data/tangut-component-variants.tsv`, built into `app/data/tangut-component-variants.json`.
//
// A `surround` form wraps what follows: beside a part under ⿰ it stands under ⿺, and it goes back
// to ⿰ where the plain form is written. A `hook` form keeps the layout of the plain form: the hook
// stays inside the part's own box. Every other description taken from it is one substitution; a
// character that carries such a description is a variant, and one no character carries is derived.

import { readDescription, writeDescription } from './composition.js'

/** @typedef {{ form: string, base: string, kind: 'surround' | 'hook' }} ComponentVariant */
/** @typedef {{ base: Map<string, string>, forms: Map<string, string[]>, kind: Map<string, string> }} Families */
/** @typedef {{ op: string, parts: Node[] } | string} Node */

/**
 * The maps a family is looked up through, from the table's rows.
 * @param {ComponentVariant[]} rows
 * @returns {Families}
 */
export function buildFamilies(rows) {
  /** @type {Map<string, string>} */
  const base = new Map()
  /** @type {Map<string, string[]>} */
  const forms = new Map()
  /** @type {Map<string, string>} */
  const kind = new Map()
  for (const row of rows) {
    base.set(row.form, row.base)
    kind.set(row.form, row.kind)
    const found = forms.get(row.base)
    if (found) found.push(row.form)
    else forms.set(row.base, [row.base, row.form])
  }
  return { base, forms, kind }
}

/** @param {Families} families @param {string} part */
export const baseOf = (families, part) => families.base.get(part) ?? part

/** The forms of a part, the plain form first. @param {Families} families @param {string} part */
export const formsOf = (families, part) => families.forms.get(baseOf(families, part)) ?? [part]

/** `surround`, `hook`, or an empty string for the plain form. @param {Families} families @param {string} form */
export const kindOf = (families, form) => families.kind.get(form) ?? ''

/** The form that wraps the part after it, where the table records one. @param {Families} families @param {string} part */
export const surroundingOf = (families, part) =>
  formsOf(families, part).find(form => kindOf(families, form) === 'surround') ?? ''

/**
 * The descriptions one substitution makes from `text`: another form of one part, under the layout
 * that form needs. A `surround` form stands only where it can wrap what follows (first in ⿰ or ⿺),
 * and the plain form it replaces turns the ⿺ back into ⿰. Descriptions with more than one root or
 * an operand short are not transformed.
 * @param {Families} families
 * @param {string} text
 * @returns {string[]}
 */
export function alternativeDescriptions(families, text) {
  const { roots, complete } = readDescription(text)
  if (!complete || roots.length !== 1) return []
  /** @type {Set<string>} */
  const out = new Set()
  /** @param {Node} node */
  const walk = node => {
    if (typeof node === 'string') return
    node.parts.forEach((part, i) => {
      if (typeof part !== 'string') { walk(part); return }
      for (const form of formsOf(families, part)) {
        if (form === part) continue
        const standing = kindOf(families, part)
        const going = kindOf(families, form)
        let op = node.op
        if (going === 'surround') {
          // Only the place before the part it wraps can hold the hook.
          if (i !== 0 || (node.op !== '⿰' && node.op !== '⿺')) continue
          op = '⿺'
        } else if (standing === 'surround') {
          // The recorded hook wraps nothing once the plain form stands there.
          if (i !== 0 || node.op !== '⿺') continue
          op = '⿰'
        }
        out.add(writeDescription({ op, parts: node.parts.map((child, at) => at === i ? form : child) }))
      }
    })
  }
  walk(roots[0])
  return [...out]
}

/**
 * The characters that carry another form of one of `char`'s parts, and the descriptions that no
 * character carries yet.
 * @param {Families} families
 * @param {Map<string, string[]>} descriptionsOf
 * @param {Map<string, string[]>} charsByDescription
 * @param {string} char
 * @returns {{ encoded: string[], derived: string[] }}
 */
export function variantsOf(families, descriptionsOf, charsByDescription, char) {
  const own = descriptionsOf.get(char) ?? []
  const encoded = new Set()
  const derived = new Set()
  for (const text of own) {
    for (const other of alternativeDescriptions(families, text)) {
      if (own.includes(other)) continue
      const chars = (charsByDescription.get(other) ?? []).filter(found => found !== char)
      if (chars.length) for (const found of chars) encoded.add(found)
      else derived.add(other)
    }
  }
  return {
    encoded: [...encoded].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0)),
    derived: [...derived].sort(),
  }
}

/**
 * Whether a description answers an outermost layout. A part whose recorded form surrounds the part
 * after it is read as the side-by-side part it stands for, so ⿰ also answers ⿺ there.
 * @param {Families} families
 * @param {string} text
 * @param {string} layout
 */
export function matchesLayout(families, text, layout) {
  if (!layout) return true
  if (text.startsWith(layout)) return true
  if (layout !== '⿰' || !text.startsWith('⿺')) return false
  const { roots, complete } = readDescription(text)
  const root = roots[0]
  return complete && roots.length === 1 && typeof root !== 'string' && root.op === '⿺'
    && typeof root.parts[0] === 'string' && kindOf(families, root.parts[0]) === 'surround'
}
