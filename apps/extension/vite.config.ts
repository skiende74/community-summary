import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const script = mode === 'content' || mode === 'background';
  return {
    build: script ? {
      emptyOutDir: false,
      lib: {
        entry: fileURLToPath(new URL(`./src/${mode}.${mode === 'content' ? 'tsx' : 'ts'}`, import.meta.url)),
        name: 'CommunitySummary', formats: ['iife'], fileName: () => `${mode}.js`,
      },
      // React's production branch must be resolved in standalone content bundles.
    } : { rollupOptions: { input: ['options.html', 'popup.html'] } },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  };
});
