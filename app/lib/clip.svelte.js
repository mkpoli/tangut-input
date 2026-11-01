// Copying, with a short confirmation of what went to the clipboard.

export const toast = $state({ message: '', id: 0 })

/** @param {string} message */
export function say(message) {
  toast.message = message
  const id = ++toast.id
  setTimeout(() => { if (toast.id === id) toast.message = '' }, 1800)
}

/** @param {string} value @param {string} [label] what was copied, for the confirmation */
export async function copy(value, label = value) {
  try {
    await navigator.clipboard.writeText(value)
    say(`Copied ${label}`)
  } catch {
    say('The browser refused the clipboard')
  }
}
