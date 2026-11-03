// Where the part record sits beside its tile: to the right when it fits, otherwise to the left,
// kept inside the viewport. The card is 300 px wide; 300 px is a working height for the rows.
/** @param {DOMRect} box */
export function partInfoPlacement(box) {
  const width = 300, height = 300, gap = 8
  let x = box.right + gap
  if (x + width > innerWidth) x = box.left - width - gap
  return {
    x: Math.max(8, Math.min(x, innerWidth - width - 8)),
    y: Math.max(8, Math.min(box.top, innerHeight - height)),
  }
}
