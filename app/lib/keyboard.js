/** @param {KeyboardEvent} event */
export function isImeKey(event) {
  // Safari can deliver the confirming keydown after compositionend.
  return event.isComposing || (event.key === 'Enter' && event.keyCode === 229)
}
