<script>
  // The site's picker on its own, for a tool that embeds this page. The tool only needs the character,
  // so that is all a pick posts to the window around it.
  import MiniFinder from './ui/MiniFinder.svelte'
  import { load } from './lib/db.svelte.js'
  import { applyTangut, applyTheme } from './lib/ui.svelte.js'

  // On the site the app does these; here there is no app.
  load()
  applyTheme()
  applyTangut()

  /** @param {string} char @param {number} _place @param {[number, number][][]} [strokes] */
  function onpick(char, _place, strokes) {
    // The strokes of a drawing travel with the pick, so the tool around this page can keep them.
    window.parent.postMessage({ type: 'tangut-pick', char, strokes: strokes ? JSON.parse(JSON.stringify(strokes)) : undefined }, '*')
    return true
  }

  /** Keys typed in a frame never reach the page around it, so Escape hands them back after a look-up
   * that ended without a pick. @param {KeyboardEvent} event */
  function onkeydown(event) {
    if (event.key !== 'Escape' || event.isComposing) return
    // Firefox leaves the keys in the frame unless the frame itself is blurred as well.
    /** @type {HTMLElement | null} */ (window.frameElement)?.blur()
    window.parent.focus()
  }
</script>

<svelte:window {onkeydown} />

<MiniFinder always {onpick} />

<style>
  /* The site reserves a scrollbar's width on every page; here the panel scrolls inside itself and the
     reserved strip would only narrow it. */
  :global(html){scrollbar-gutter:auto}
</style>
