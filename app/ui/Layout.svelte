<script>
  // A small picture of an IDS layout, so the operators read without a font that carries them.
  /** @type {{ op: string, size?: number }} */
  let { op, size = 14 } = $props()

  const SHAPES = /** @type {Record<string, string>} */ ({
    '⿰': 'M2 2h5v12H2zM9 2h5v12H9z',
    '⿱': 'M2 2h12v5H2zM2 9h12v5H2z',
    '⿲': 'M1.5 2h3.4v12H1.5zM6.3 2h3.4v12H6.3zM11.1 2h3.4v12h-3.4z',
    '⿳': 'M2 1.5h12v3.4H2zM2 6.3h12v3.4H2zM2 11.1h12v3.4H2z',
    '⿴': 'M2 2h12v12H2zM5.5 5.5v5h5v-5z',
    '⿵': 'M2 2h12v12h-3V5.5h-6V14H2z',
    '⿶': 'M2 2h3v8.5h6V2h3v12H2z',
    '⿷': 'M2 2h12v3H5.5v6H14v3H2z',
    '⿸': 'M2 2h12v3H5v9H2z',
    '⿹': 'M2 2h12v12h-3V5H2z',
    '⿺': 'M2 2h3v9h9v3H2z',
    '⿻': 'M3 2h6v8H3zM7 6h6v8H7z',
  })
</script>

<svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
  <path d={SHAPES[op] ?? 'M3 3h10v10H3z'} fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill-rule="evenodd" />
</svg>
