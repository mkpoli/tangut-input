import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// The Tangut Input site: one page, served at the root of https://tangut.mkpo.li/.
export default defineConfig({
  root: import.meta.dirname,
  base: '/',
  plugins: [svelte()],
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
})
