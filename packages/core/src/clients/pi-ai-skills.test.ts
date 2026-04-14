import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createMockLogger } from '../test/mocks/logger';

// Mock @archon/paths (before any imports)
const mockLogger = createMockLogger();
mock.module('@archon/paths', () => ({
  createLogger: mock(() => mockLogger),
}));

// Import after mocks
import { discoverSkills, buildSkillSystemPrompt, loadSkillContent } from './pi-ai-skills';
import type { PiSkill } from './pi-ai-skills';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

describe('pi-ai-skills', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `pi-ai-skills-test-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });
    mockLogger.debug.mockClear();
    mockLogger.warn.mockClear();
  });

  // Clean up temp dirs after each test
  function cleanup(): void {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  describe('discoverSkills', () => {
    test('returns empty array when no skill directories exist', async () => {
      const skills = await discoverSkills(tempDir);
      expect(skills).toEqual([]);
      cleanup();
    });

    test('discovers skills from .pi/skills/ directory', async () => {
      const skillDir = join(tempDir, '.pi', 'skills', 'my-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        `---\nname: my-skill\ndescription: A test skill\n---\n\n# Instructions\nDo stuff.`
      );

      const skills = await discoverSkills(tempDir);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('my-skill');
      expect(skills[0].description).toBe('A test skill');
      cleanup();
    });

    test('discovers skills from .agents/skills/ directory', async () => {
      const skillDir = join(tempDir, '.agents', 'skills', 'agent-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        `---\nname: agent-skill\ndescription: Agent compat skill\n---\n\nContent`
      );

      const skills = await discoverSkills(tempDir);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('agent-skill');
      cleanup();
    });

    test('deduplicates skills by name (first occurrence wins)', async () => {
      // Create same-named skill in both directories
      const piDir = join(tempDir, '.pi', 'skills', 'common-skill');
      const agentsDir = join(tempDir, '.agents', 'skills', 'common-skill');
      mkdirSync(piDir, { recursive: true });
      mkdirSync(agentsDir, { recursive: true });

      writeFileSync(join(piDir, 'SKILL.md'), `---\nname: common-skill\ndescription: From pi\n---`);
      writeFileSync(
        join(agentsDir, 'SKILL.md'),
        `---\nname: common-skill\ndescription: From agents\n---`
      );

      const skills = await discoverSkills(tempDir);
      expect(skills).toHaveLength(1);
      expect(skills[0].description).toBe('From pi'); // First wins
      cleanup();
    });

    test('uses directory name as fallback when frontmatter is incomplete', async () => {
      const skillDir = join(tempDir, '.pi', 'skills', 'unnamed-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), `# Just markdown, no frontmatter`);

      const skills = await discoverSkills(tempDir);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('unnamed-skill');
      cleanup();
    });

    test('discovers skills from extra paths', async () => {
      const extraDir = join(tempDir, 'custom-skills', 'extra-skill');
      mkdirSync(extraDir, { recursive: true });
      writeFileSync(
        join(extraDir, 'SKILL.md'),
        `---\nname: extra-skill\ndescription: From extra path\n---`
      );

      const skills = await discoverSkills(tempDir, ['custom-skills']);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('extra-skill');
      cleanup();
    });
  });

  describe('buildSkillSystemPrompt', () => {
    test('returns empty string for no skills', () => {
      expect(buildSkillSystemPrompt([])).toBe('');
    });

    test('builds XML block with skill entries', () => {
      const skills: PiSkill[] = [
        { name: 'deploy', description: 'Deploy to prod', filePath: '/path/to/SKILL.md' },
        { name: 'test', description: 'Run tests', filePath: '/path/to/test/SKILL.md' },
      ];
      const result = buildSkillSystemPrompt(skills);
      expect(result).toContain('<available_skills>');
      expect(result).toContain('</available_skills>');
      expect(result).toContain('name="deploy"');
      expect(result).toContain('description="Deploy to prod"');
      expect(result).toContain('name="test"');
    });

    test('escapes XML special characters', () => {
      const skills: PiSkill[] = [{ name: 'a<b', description: 'x & "y"', filePath: '/path' }];
      const result = buildSkillSystemPrompt(skills);
      expect(result).toContain('a&lt;b');
      expect(result).toContain('x &amp; &quot;y&quot;');
    });
  });

  describe('loadSkillContent', () => {
    test('returns file content for existing skill', async () => {
      const skillFile = join(tempDir, 'SKILL.md');
      writeFileSync(skillFile, '# My Skill\nDo things.');
      const content = await loadSkillContent(skillFile);
      expect(content).toBe('# My Skill\nDo things.');
      cleanup();
    });

    test('returns null for non-existent file', async () => {
      const content = await loadSkillContent('/nonexistent/SKILL.md');
      expect(content).toBeNull();
      cleanup();
    });
  });
});
