// Types (contract layer — re-exported for convenience)
export type {
  IAgentProvider,
  AgentRequestOptions,
  SendQueryOptions,
  NodeConfig,
  ProviderDefaults,
  ProviderDefaultsMap,
  ProviderCapabilities,
  ProviderRegistration,
  ProviderInfo,
  MessageChunk,
  TokenUsage,
} from './types';

// Provider config types (canonical definitions in ./types, re-exported via config modules)
// Import from ./types directly or from the config modules — both work.

// Registry
export {
  registerProvider,
  getAgentProvider,
  getRegistration,
  getProviderCapabilities,
  getRegisteredProviders,
  getProviderInfoList,
  isRegisteredProvider,
  registerBuiltinProviders,
  clearRegistry,
} from './registry';

// Error
export { UnknownProviderError } from './errors';

// Provider classes
export { ClaudeProvider } from './claude/provider';
export { CodexProvider } from './codex/provider';

// Config parsers
export { parseClaudeConfig, type ClaudeProviderDefaults } from './claude/config';
export { parseCodexConfig, type CodexProviderDefaults } from './codex/config';
export { parsePiAiConfig, type PiAiProviderDefaults } from './pi-ai/config';

// Provider classes
export { PiAiProvider } from './pi-ai/provider';

// Pi-AI utilities
export { buildPiBeforeToolCall, buildPiAfterToolCall } from './pi-ai/provider';
export { discoverSkills, buildSkillSystemPrompt, loadSkillContent } from './pi-ai/skills';

// Session persistence
export { PiAiSessionStore } from './pi-ai/pi-ai-sessions';
export type { PiSkill } from './pi-ai/skills';

// Utilities (needed by consumers)
export { resetCodexSingleton } from './codex/provider';
export { resolveCodexBinaryPath, fileExists as codexFileExists } from './codex/binary-resolver';
export { resolveClaudeBinaryPath, fileExists as claudeFileExists } from './claude/binary-resolver';
