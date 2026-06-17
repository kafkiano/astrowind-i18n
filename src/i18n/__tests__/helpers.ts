import type { TranslationProvider } from '~/i18n/provider';

/**
 * Deterministic fake translation provider for unit tests.
 * Wraps every input string in square brackets so assertions are provider-free.
 */
export const fakeProvider: TranslationProvider = {
  name: 'fake',
  maxBatchSize: 10,
  translateBatch: async (texts) => texts.map((t) => `[${t}]`),
  translateText: async (text) => `[${text}]`,
  translatePlainText: async (text) => `[${text}]`,
  translatePlainTextBatch: async (texts) => texts.map((t) => `[${t}]`),
};
