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
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        design: resolve(import.meta.dirname, 'design.html'),
      },
    },
  },
})
