import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import PO from 'pofile';

interface PoMessage {
  msgid: string;
  msgstr: string;
  references: string[];
}

/**
 * Load a PO file and return messages as a Map keyed by msgid.
 */
export async function loadPO(filepath: string): Promise<Map<string, PoMessage>> {
  const content = await readFile(filepath, 'utf-8');
  const po = PO.parse(content);
  const messages = new Map<string, PoMessage>();

  for (const item of po.items) {
    if (item.msgid) {
      messages.set(item.msgid, {
        msgid: item.msgid,
        msgstr: item.msgstr[0] || '',
        references: item.references,
      });
    }
  }

  return messages;
}

/**
 * Save messages to a PO file.
 *
 * @param filepath - Output PO file path
 * @param messages - Map of msgid → { msgid, msgstr, references }
 * @param locale - Target locale code
 * @param sourceLocale - Source locale code
 */
export async function savePO(
  filepath: string,
  messages: Map<string, PoMessage>,
  locale: string,
  sourceLocale: string
): Promise<void> {
  const po = new PO();

  po.headers = {
    'Project-Id-Version': '',
    'Report-Msgid-Bugs-To': '',
    'POT-Creation-Date': new Date().toISOString(),
    'PO-Revision-Date': new Date().toISOString(),
    'Last-Translator': '',
    Language: locale,
    'Language-Team': '',
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Transfer-Encoding': '8bit',
    'Plural-Forms': 'nplurals=2; plural=n == 1 ? 0 : 1;',
    'Source-Language': sourceLocale,
    'MIME-Version': '1.0',
  };

  for (const msg of messages.values()) {
    const item = new PO.Item();
    item.msgid = msg.msgid;
    item.msgstr = [msg.msgstr];
    item.references = msg.references;
    po.items.push(item);
  }

  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, po.toString(), 'utf-8');
}

/**
 * Find messages that have no translation (empty msgstr).
 */
export function findUntranslated(messages: Map<string, PoMessage>): PoMessage[] {
  const untranslated: PoMessage[] = [];
  for (const msg of messages.values()) {
    if (!msg.msgstr || msg.msgstr === msg.msgid) {
      untranslated.push(msg);
    }
  }
  return untranslated;
}

/**
 * Merge new messages into an existing PO file.
 * Preserves existing translations for matching msgids.
 * Adds new messages with empty msgstr.
 * Returns the merged messages and whether there were changes.
 */
export function mergeMessages(
  existing: Map<string, PoMessage>,
  newMessages: Array<{ msgid: string; references?: string[] }>
): { merged: Map<string, PoMessage>; hasNew: boolean } {
  const merged = new Map(existing);
  let hasNew = false;

  for (const msg of newMessages) {
    if (!merged.has(msg.msgid)) {
      merged.set(msg.msgid, {
        msgid: msg.msgid,
        msgstr: '',
        references: msg.references || [],
      });
      hasNew = true;
    } else {
      // Update references if changed
      const existing = merged.get(msg.msgid)!;
      if (msg.references && msg.references.length > 0) {
        existing.references = msg.references;
      }
    }
  }

  return { merged, hasNew };
}
