import type { Plugin } from 'vite';
import { emitAll, emitFile } from './markdown-emitter';
import type { EmitterOptions } from './markdown-emitter';
import { extname } from 'node:path';

export interface MarkdownPluginOptions {
  configs: EmitterOptions[];
}

/**
 * Single Vite plugin that handles all markdown content types.
 * Replaces 3 separate plugin instances with one shared build lifecycle.
 */
export function markdownPlugin(options: MarkdownPluginOptions): Plugin {
  let emitted = false;

  return {
    name: 'astrowind-markdown',

    async buildStart() {
      if (emitted) return;
      emitted = true;

      for (const cfg of options.configs) {
        console.log(`[markdown] ${cfg.sourceDir.split('/').pop()}: generating locale files...`);
        await emitAll(cfg);
      }
      console.log('[markdown] All locale files generated.');
    },

    async handleHotUpdate({ file, server }) {
      if (extname(file) !== '.md') return;

      const matching = options.configs.find((c) => file.includes(c.sourceDir));
      if (!matching) return;

      console.log(`[markdown] File changed: ${file}`);
      await emitFile(file, matching);
      server.ws.send({ type: 'full-reload' });
    },
  };
}
