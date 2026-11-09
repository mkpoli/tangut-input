// The Digital Wenhai, indexed for the card and the chains page: every head by the character it
// records, every chain by its published identifier, and the chains each character stands in.
// A graph node can carry a suffix when one character is read two ways (`𘅇a`, `𘅇b`); the suffix
// stays on the node, and the character it is read as is the first code point.
/** @typedef {import('./data.js').Wenhai} Wenhai */
/** @typedef {import('./data.js').WenhaiHead} WenhaiHead */
/** @typedef {import('./data.js').WenhaiChain} WenhaiChain */

/** @typedef {{ doc: Wenhai, chains: Map<string, WenhaiChain & { graph: 'initial' | 'rhyme' }>,
 *   heads: Map<string, WenhaiHead[]>, members: Map<string, { initial: Set<string>, rhyme: Set<string> }> }} WenhaiIndex */

/** The character a graph node names. A Tangut character is two UTF-16 units, so the first code
 *  point is taken rather than the first unit. @param {string} node */
export const nodeChar = node => [...node][0] ?? ''

/** Index a release document once, when the records load. @param {Wenhai} doc @returns {WenhaiIndex} */
export function indexWenhai(doc) {
  /** @type {Map<string, WenhaiChain & { graph: 'initial' | 'rhyme' }>} */
  const chains = new Map()
  /** @type {Map<string, { initial: Set<string>, rhyme: Set<string> }>} */
  const members = new Map()
  /** @type {[('initial' | 'rhyme'), WenhaiChain[]][]} */
  const graphs = [['initial', doc.initial], ['rhyme', doc.rhyme]]
  for (const [graph, list] of graphs) {
    for (const chain of list) {
      chains.set(chain.id, { ...chain, graph })
      for (const node of chain.members) {
        const char = nodeChar(node)
        const found = members.get(char) ?? { initial: new Set(), rhyme: new Set() }
        found[graph].add(chain.id)
        members.set(char, found)
      }
    }
  }
  /** @type {Map<string, WenhaiHead[]>} */
  const heads = new Map()
  for (const head of doc.heads) {
    const char = nodeChar(head.char)
    const list = heads.get(char)
    if (list) list.push(head)
    else heads.set(char, [head])
  }
  return { doc, chains, heads, members }
}

/**
 * The chains a character stands in, initial first.
 * @param {WenhaiIndex} wenhai @param {string} char
 * @returns {{ initial: (WenhaiChain & { graph: 'initial' | 'rhyme' })[], rhyme: (WenhaiChain & { graph: 'initial' | 'rhyme' })[] }}
 */
export function chainsOf(wenhai, char) {
  const found = wenhai.members.get(char)
  const pick = (/** @type {'initial' | 'rhyme'} */ graph) =>
    [...(found?.[graph] ?? [])].map(id => /** @type {WenhaiChain & { graph: 'initial' | 'rhyme' }} */ (wenhai.chains.get(id))).filter(Boolean)
  return { initial: pick('initial'), rhyme: pick('rhyme') }
}

/**
 * A chain's members as characters, each once, without the reading suffix: the tiles a page shows.
 * @param {WenhaiChain} chain
 * @returns {string[]}
 */
export function memberChars(chain) {
  return [...new Set(chain.members.map(nodeChar))]
}

/**
 * The release's cross tables name a junction as `19.162: 𗱡 [VIII] → 𗂏 [III] (upper; 𗱡𗑊𘈖𗤁)`;
 * split at the semicolons so a chain can list each one.
 * @param {string | null} junctions
 * @returns {string[]}
 */
export function junctionLines(junctions) {
  return junctions ? junctions.split(/;\s*/).filter(Boolean) : []
}

/**
 * The evidence of an initial chain is written `𗉣=I; 𗩙=I`: a speller and the class it is filed
 * under. @param {string | null} evidence
 * @returns {{ char: string, ty: string }[]}
 */
export function classEvidence(evidence) {
  /** @type {{ char: string, ty: string }[]} */
  const rows = []
  for (const pair of evidence?.split(/;\s*/) ?? []) {
    const at = pair.lastIndexOf('=')
    if (at > 0) rows.push({ char: pair.slice(0, at), ty: pair.slice(at + 1) })
  }
  return rows
}
