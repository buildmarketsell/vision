import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const page = (name: string) => fileURLToPath(new URL(`./src/renderer/${name}`, import.meta.url));

export default defineConfig({
  main: {},
  preload: {
    // Sandboxed preloads must be a single CommonJS file.
    build: { rolldownOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    // Two pages: VISION's windows, and the focus island under the notch.
    build: { rolldownOptions: { input: { index: page('index.html'), island: page('island.html') } } },
  },
});
