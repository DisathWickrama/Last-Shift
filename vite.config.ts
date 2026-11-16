// Vite configuration.
// `base: './'` makes every asset URL relative, so the built game works no matter
// which folder it is served from (GitHub Pages serves it from /Last-Shift/).
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
