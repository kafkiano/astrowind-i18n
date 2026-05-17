/**
 * JSON-based translation memory for markdown content.
 * Replaces the .po-file-based markdown-po.ts.
 *
 * One JSON file: .i18n-cache/content-translations.json
 * Format: { msgid: { msgstr: string, references: string[] } }
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface TranslationEntry {
  msgstr: string;
  references: string[];
}

export type TranslationMemory = Map<string, TranslationEntry>;

const MEMORY_PATH = '.i18n-cache/content-translations.json';

function memoryPath(locale: string): string {
  return `.i18n-cache/content-translations-${locale}.json`;
}

/** Load the translation memory for a specific locale. */
export async function loadMemory(locale: string): Promise<TranslationMemory> {
  try {
    const raw = await readFile(memoryPath(locale), 'utf-8');
    const data = JSON.parse(raw) as Record<string, TranslationEntry>;
    return new Map(Object.entries(data));
  } catch {
    // Fall back to legacy shared file, then empty
    try {
      const raw = await readFile(MEMORY_PATH, 'utf-8');
      const data = JSON.parse(raw) as Record<string, TranslationEntry>;
      return new Map(Object.entries(data));
    } catch {
      return new Map();
    }
  }
}

/** Save the translation memory for a specific locale. */
export async function saveMemory(locale: string, memory: TranslationMemory): Promise<void> {
  await mkdir(dirname(memoryPath(locale)), { recursive: true });
  const obj: Record<string, TranslationEntry> = {};
  for (const [key, entry] of memory) {
    obj[key] = entry;
  }
  await writeFile(memoryPath(locale), JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

/** Find entries with empty msgstr that need translation. */
export function findUntranslated(memory: TranslationMemory): Array<{ msgid: string } & TranslationEntry> {
  const result: Array<{ msgid: string } & TranslationEntry> = [];
  for (const [msgid, entry] of memory) {
    // Empty or whitespace-only msgstr → needs translation
    const msgstr = entry.msgstr?.trim();
    if (!msgstr) {
      result.push({ msgid, ...entry });
    }
  }
  return result;
}

/**
 * Merge new messages into the translation memory.
 * Preserves existing translations. Adds new entries with empty msgstr.
 */
export function mergeMessages(
  memory: TranslationMemory,
  newMessages: Array<{ msgid: string; references?: string[] }>
): { memory: TranslationMemory; hasNew: boolean } {
  let hasNew = false;

  for (const msg of newMessages) {
    if (!memory.has(msg.msgid)) {
      memory.set(msg.msgid, {
        msgstr: '',
        references: msg.references || [],
      });
      hasNew = true;
    } else {
      // Update references
      const existing = memory.get(msg.msgid)!;
      if (msg.references?.length) {
        existing.references = msg.references;
      }
    }
  }

  return { memory, hasNew };
}
