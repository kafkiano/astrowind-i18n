import type { Plugin } from 'vite';
import { emitAll, emitFile } from './markdown-emitter';
import type { EmitterOptions } from './markdown-emitter';
import { extname } from 'node:path';

/**
 * Vite plugin that:
 * - Runs emitAll() on build start to generate all locale files
 * - Watches .md files for HMR during dev
 */
export function markdownPlugin(options: EmitterOptions): Plugin {
  let hasEmitted = false;

  return {
    name: 'astrowind-markdown',

    async buildStart() {
      // Only emit once per build cycle
      if (hasEmitted) {
        console.log('[markdown] Already emitted, skipping...');
        return;
      }
      hasEmitted = true;
      console.log('[markdown] Generating locale files...');
      await emitAll(options);
      console.log('[markdown] Locale files generated.');
    },

    async handleHotUpdate({ file, server }) {
      const ext = extname(file);

      // Only handle .md file changes
      if (ext !== '.md') {
        return;
      }

      // Check if the file is in our watched directories
      const isMarkdown = file.includes(options.sourceDir);

      if (!isMarkdown) {
        return;
      }

      console.log(`[markdown] File changed: ${file}`);

      // Re-emit just this file
      await emitFile(file, options);

      // Trigger full reload since content collections need refresh
      server.ws.send({ type: 'full-reload' });
    },
  };
}
