/**
 * Typed config parsing for Pi-AI provider defaults.
 * Validates and narrows the opaque assistantConfig to typed fields.
 */
import type { PiAiProviderDefaults } from '../types';

// Re-export so consumers can import the type from either location
export type { PiAiProviderDefaults } from '../types';

/**
 * Parse raw assistantConfig into typed Pi-AI defaults.
 * Defensive: invalid fields are silently dropped (not thrown).
 */
export function parsePiAiConfig(raw: Record<string, unknown>): PiAiProviderDefaults {
  const result: PiAiProviderDefaults = {};

  if (typeof raw.model === 'string') {
    result.model = raw.model;
  }

  if (typeof raw.provider === 'string') {
    result.provider = raw.provider;
  }

  if (typeof raw.thinkingLevel === 'string') {
    const valid = ['off', 'low', 'medium', 'high', 'xhigh'];
    if (valid.includes(raw.thinkingLevel)) {
      result.thinkingLevel = raw.thinkingLevel as PiAiProviderDefaults['thinkingLevel'];
    }
  }

  if (Array.isArray(raw.skillPaths)) {
    const valid = raw.skillPaths.filter((s): s is string => typeof s === 'string');
    if (valid.length > 0) {
      result.skillPaths = valid;
    }
  }

  return result;
}
