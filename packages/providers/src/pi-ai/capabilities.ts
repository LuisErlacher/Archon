import type { ProviderCapabilities } from '../types';

export const PI_AI_CAPABILITIES: ProviderCapabilities = {
  sessionResume: true,
  mcp: false,
  hooks: true,
  skills: true,
  toolRestrictions: true,
  structuredOutput: true, // via system prompt injection (not native)
  envInjection: false,
  costControl: false,
  effortControl: false,
  thinkingControl: true,
  fallbackModel: false,
  sandbox: false,
};
