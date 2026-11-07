// One spelling card is open at a time: opening another closes the one before it.
/** @type {(() => void) | null} */
let current = null

/** Take the open card's place, closing the card that held it. @param {() => void} close */
export function claim(close) {
  if (current && current !== close) current()
  current = close
}

/** Give up the place, if this card still holds it. @param {() => void} close */
export function release(close) {
  if (current === close) current = null
}
