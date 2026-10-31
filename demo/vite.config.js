import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// A static site served at the root of https://tangut.mkpo.li/ behind the worker in `worker/`, which
// answers any path with the app so a sequence can live in the path.
export default defineConfig({
  root: import.meta.dirname,
  base: '/',
  plugins: [svelte()],
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022',
    rollupOptions: { input: { index: `${import.meta.dirname}/index.html` } } },
  server: { fs: { allow: ['..'] } },
})
