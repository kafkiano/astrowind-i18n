import type { Plugin } from 'vite';
import { emitAll, emitFile } from './markdown-emitter';
import type { EmitterOptions } from './markdown-emitter';
import { extname } from 'node:path';

/**
 * Vite plugin that:
 * - Runs emitAll() on build start to generate all locale files
 * - Watches .md and .po files for HMR during dev
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

      // Only handle .md and .po file changes
      if (ext !== '.md' && ext !== '.po') {
        return;
      }

      // Check if the file is in our watched directories
      const isMarkdown = file.endsWith('.md') && file.includes(options.sourceDir);
      const isPo = file.endsWith('.po') && file.includes(options.localesDir);

      if (!isMarkdown && !isPo) {
        return;
      }

      console.log(`[markdown] File changed: ${file}`);

      if (isMarkdown) {
        // Re-emit just this file
        await emitFile(file, options);
      } else {
        // PO file changed: re-emit all files (translations may affect multiple pages)
        await emitAll(options);
      }

      // Trigger full reload since content collections need refresh
      server.ws.send({ type: 'full-reload' });
    },
  };
}
