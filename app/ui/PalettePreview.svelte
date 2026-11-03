<script>
  /** @type {{ key: string, size?: number }} */
  let { key, size = 18 } = $props()
</script>

<span class="palette-preview" data-palette={key} style:--preview-size="{size}px" aria-hidden="true"></span>

<style>
  .palette-preview{display:inline-block;flex:none;inline-size:var(--preview-size);block-size:var(--preview-size);border:1px solid var(--ui-color-border-strong);border-radius:50%;background:conic-gradient(from -90deg,var(--p-canvas) 0 55%,var(--p-accent) 55% 82%,var(--p-ink) 82% 100%)}
</style>
