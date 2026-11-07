/**
 * Keep an immutable completed-stroke snapshot until a pause, pick, or destructive action.
 * @param {(event: any) => void} emit
 * @param {number} [delay]
 */
export function createDrawingCapture(emit, delay = 700) {
  /** @type {any} */
  let snapshot = null
  let sent = new Set()
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer
  /** @param {{ picked?: string, place?: number | null }} [label] */
  function capture(label = {}) {
    clearTimeout(timer)
    if (!snapshot?.strokes.length) return false
    const key = label.picked ?? ''
    if (sent.has(key) || (!key && sent.size)) return true
    emit({ type: 'drawing', ...snapshot, ...label })
    sent.add(key)
    return true
  }
  return {
    /** @param {any} drawing */
    update(drawing) {
      clearTimeout(timer)
      // Own the points: pointer movement and clearing must never mutate a queued drawing.
      snapshot = drawing?.strokes.length ? JSON.parse(JSON.stringify(drawing)) : null
      sent = new Set()
      if (snapshot) timer = setTimeout(capture, delay)
    },
    capture,
    clear() { capture(); snapshot = null; sent = new Set(); clearTimeout(timer) },
  }
}
