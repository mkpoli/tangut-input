import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'node:path'

// The Tangut Input site, served at the root of https://tangut.mkpo.li/, and the design-system
// reference page built beside it.
export default defineConfig({
  root: import.meta.dirname,
  base: '/',
  plugins: [svelte()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    // Gzipped data files are fetched on their own and cached; inlining the small ones as data URLs
    // makes the same file arrive by two different paths depending on its size.
    assetsInlineLimit: file => (file.endsWith('.gz') ? false : undefined),
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        design: resolve(import.meta.dirname, 'design.html'),
        pick: resolve(import.meta.dirname, 'pick.html'),
      },
    },
  },
})
