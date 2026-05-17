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

/** Normalize msgid: trim and collapse whitespace to single spaces. */
export function normalizeMsgid(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const MEMORY_PATH = '.i18n-cache/content-translations.json';

function memoryPath(locale: string): string {
  return `.i18n-cache/content-translations-${locale}.json`;
}

/** Load the translation memory for a specific locale. */
export async function loadMemory(locale: string): Promise<TranslationMemory> {
  const normalizeEntries = (data: Record<string, TranslationEntry>) => {
    const normalized = new Map<string, TranslationEntry>();
    for (const [key, entry] of Object.entries(data)) {
      const normKey = normalizeMsgid(key);
      const existing = normalized.get(normKey);
      // Prefer entry with translation; normalized key wins
      if (!existing || (!existing.msgstr && entry.msgstr)) {
        normalized.set(normKey, entry);
      }
    }
    return normalized;
  };

  try {
    const raw = await readFile(memoryPath(locale), 'utf-8');
    return normalizeEntries(JSON.parse(raw));
  } catch {
    try {
      const raw = await readFile(MEMORY_PATH, 'utf-8');
      return normalizeEntries(JSON.parse(raw));
    } catch {
      return new Map();
    }
  }
}

/** Save the translation memory for a specific locale. */
export async function saveMemory(locale: string, memory: TranslationMemory): Promise<void> {
  await mkdir(dirname(memoryPath(locale)), { recursive: true });
  // Ensure keys are normalized
  const obj: Record<string, TranslationEntry> = {};
  for (const [key, entry] of memory) {
    obj[normalizeMsgid(key)] = entry;
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
    const normalized = normalizeMsgid(msg.msgid);
    
    // Check if a non-normalized variant exists (backward compat)
    const existingEntry = memory.get(normalized) || memory.get(msg.msgid);
    
    if (!existingEntry) {
      memory.set(normalized, {
        msgstr: '',
        references: msg.references || [],
      });
      hasNew = true;
      // Remove non-normalized key if it exists from a previous pass
      if (normalized !== msg.msgid) {
        memory.delete(msg.msgid);
      }
    } else {
      // Normalize the key if it was stored non-normalized
      if (normalized !== msg.msgid) {
        memory.delete(msg.msgid);
        memory.set(normalized, existingEntry);
      }
      // Update references
      if (msg.references?.length) {
        existingEntry.references = msg.references;
      }
    }
  }

  return { memory, hasNew };
}
