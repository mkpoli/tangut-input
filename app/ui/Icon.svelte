<script>
  // One set of line icons for the whole site: a 20-unit square, a 1.5 stroke, round ends and the
  // colour of the text beside them. The Tangut faces stay the site's signature; these mark what a
  // control does, in the bar, on a page and on a button.
  const ICONS = {
    find: '<circle cx="8.8" cy="8.8" r="5.3"/><path d="M12.7 12.7 17 17"/>',
    cangjie: '<rect x="2.5" y="5.5" width="15" height="10" rx="2"/><path d="M5.5 9h1M8 9h1M10.5 9h1M13 9h1M6 12.5h8"/>',
    sijiao: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M6.5 8V6.5H8M13.5 6.5H12V8M12 13.5h1.5V12M8 12v1.5H6.5"/>',
    draw: '<path d="M4 16l.8-3.6L14.2 3a2.1 2.1 0 0 1 3 3L7.6 15.2z"/><path d="m12.8 4.4 2.8 2.8"/>',
    parts: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="7" y="11" width="6" height="6" rx="1"/>',
    fanqie: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><path d="M13 6v8M9 10h8"/>',
    chart: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M3 8h14M3 12.5h14M8 3v14M12.5 3v14"/>',
    reading: '<path d="M2.5 10h2l1.8-4.5 3 9 2.2-6 1.8 3h4.2"/>',
    transcribe: '<path d="M5 3h7l3 3v11H5z"/><path d="M12 3v3h3M7.5 9.5h5M7.5 12.5h5M7.5 15.5h3"/>',
    meaning: '<path d="M10 6.5C8 5 5.5 4.5 3 5v10c2.5-.5 5 0 7 1.5 2-1.5 4.5-2 7-1.5V5c-2.5-.5-5 0-7 1.5z"/><path d="M10 6.5v10"/>',
    sources: '<rect x="3.5" y="4" width="13" height="3.4" rx="1"/><rect x="3.5" y="8.6" width="13" height="3.4" rx="1"/><rect x="3.5" y="13.2" width="9" height="3.4" rx="1"/>',
    more: '<circle cx="4.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor" stroke="none"/>',
    shape: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M6.5 6.5h7M10 6.5v7M7.5 13.5h5"/>',
    sound: '<path d="M4 8h3l4-3v10l-4-3H4z"/><path d="M14 7.5a3.5 3.5 0 0 1 0 5M15.8 5.5a6 6 0 0 1 0 9"/>',
    sense: '<path d="M3.5 5h13v7.5H9.8L6 16v-3.5H3.5z"/><path d="M7 8.5h6M7 11h4"/>',
    copy: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M4.5 13V5.5A1.5 1.5 0 0 1 6 4h7.5"/>',
    add: '<path d="M10 4v12M4 10h12"/>',
    back: '<path d="M12.5 4 6.5 10l6 6"/>',
    close: '<path d="m5 5 10 10M15 5 5 15"/>',
    link: '<path d="m8.2 11.8 3.6-3.6"/><path d="M7 9 4.8 11.2a3 3 0 0 0 4.2 4.2L11.2 13M13 11l2.2-2.2a3 3 0 0 0-4.2-4.2L8.8 6.8"/>',
    undo: '<path d="M4.5 10h7a4 4 0 0 1 0 8H8"/><path d="M4.5 10 8 6.5M4.5 10 8 13.5"/>',
    clear: '<path d="M3.5 13.5 11 6l4.5 4.5L11 15H6z"/><path d="M9 17h8"/>',
    prev: '<path d="M12 5l-5 5 5 5"/>',
    next: '<path d="M8 5l5 5-5 5"/>',
    code: '<path d="M7.5 3.5 6 16.5M14 3.5l-1.5 13M3.5 7.5h13M3 12.5h13"/>',
    layers: '<path d="M10 3 3 7l7 4 7-4z"/><path d="M3 11l7 4 7-4"/><path d="M3 15l7 4 7-4"/>',
    globe: '<circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3c3 3 3 11 0 14M10 3c-3 3-3 11 0 14"/>',
    palette: '<path d="M10 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9z"/>',
    sun: '<circle cx="10" cy="10" r="3.6" fill="currentColor" stroke="none"/><path d="M10 2v2.4M10 15.6V18M2 10h2.4M15.6 10H18M4.3 4.3l1.7 1.7M14 14l1.7 1.7M4.3 15.7 6 14M14 6l1.7-1.7"/>',
    moon: '<path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1z" fill="currentColor" stroke="none"/>',
    auto: '<circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" stroke="none"/>',
    keyboard: '<rect x="2.5" y="5.5" width="15" height="10" rx="2"/><path d="M5.5 9h1M8 9h1M10.5 9h1M13 9h1M6 12.5h8"/>',
    book: '<path d="M3 4.5h5.5c1 0 1.5.6 1.5 1.5v10c0-.9-.5-1.5-1.5-1.5H3zM17 4.5h-5.5c-1 0-1.5.6-1.5 1.5v10c0-.9.5-1.5 1.5-1.5H17z"/>',
    arrow: '<path d="M4 10h12M11.5 5.5 16 10l-4.5 4.5"/>',
    scroll: '<path d="M6 4h7a2 2 0 0 1 2 2v11H7a1.5 1.5 0 0 1 0-3h8"/><path d="M7 4a1.5 1.5 0 0 0 0 3"/>',
    archive: '<rect x="3" y="4.5" width="14" height="4" rx="1"/><path d="M4.5 8.5v7h11v-7M8 11.5h4"/>',
    settings: '<path d="M3 6h8M15 6h2M3 14h2M9 14h8"/><circle cx="13" cy="6" r="2"/><circle cx="7" cy="14" r="2"/>',
  }

  /** @type {{ name: keyof typeof ICONS, size?: number, stroke?: number }} */
  let { name, size = 16, stroke = 1.5 } = $props()
</script>

<svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false" fill="none"
  stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round">
  {@html ICONS[name] ?? ''}
</svg>

<style>
  svg{flex:none;display:inline-block;vertical-align:-.14em}
</style>
