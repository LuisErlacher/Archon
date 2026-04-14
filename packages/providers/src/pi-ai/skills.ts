/**
 * Lightweight skill discovery for pi-ai Agent.
 *
 * Discovers skill files (SKILL.md) from standard directories, parses YAML
 * frontmatter, and builds an XML block for the system prompt — the same
 * mechanism used internally by pi-coding-agent.
 *
 * Discovery order:
 * 1. `.pi/skills/` (project-level)
 * 2. `.agents/skills/` (Claude Code compat)
 * 3. Extra paths passed via workflow config
 */
import { readdir, readFile } from 'fs/promises';
import { resolve, join, basename, dirname } from 'path';
import { createLogger } from '@archon/paths';

/** Lazy-initialized logger */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('pi-ai.skills');
  return cachedLog;
}

/** Parsed skill metadata from SKILL.md frontmatter */
export interface PiSkill {
  name: string;
  description: string;
  filePath: string;
}

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Expects `---` delimited frontmatter with `name:` and `description:` fields.
 * Returns null if frontmatter is missing or invalid.
 */
function parseFrontmatter(content: string): { name?: string; description?: string } | null {
  const match = /^---\s*\n([\s\S]*?)\n---/.exec(content);
  if (!match) return null;

  const lines = match[1].split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

/**
 * Scan a single directory for SKILL.md files (one level deep — each skill
 * lives in its own subdirectory, e.g. `.pi/skills/my-skill/SKILL.md`).
 */
async function scanSkillDir(dirPath: string): Promise<PiSkill[]> {
  const skills: PiSkill[] = [];

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = join(dirPath, entry.name, 'SKILL.md');
    try {
      const content = await readFile(skillFile, 'utf-8');
      const fm = parseFrontmatter(content);
      if (fm?.name && fm?.description) {
        skills.push({
          name: fm.name,
          description: fm.description,
          filePath: skillFile,
        });
      } else {
        skills.push({
          name: entry.name,
          description: `Skill from ${basename(dirname(skillFile))}/${entry.name}`,
          filePath: skillFile,
        });
      }
    } catch {
      // SKILL.md doesn't exist in this subdirectory
    }
  }

  return skills;
}

/**
 * Discover skills from standard directories relative to cwd.
 * Searches `.pi/skills/` and `.agents/skills/`, plus any extra paths.
 * Deduplicates by skill name (first occurrence wins).
 */
export async function discoverSkills(cwd: string, extraPaths?: string[]): Promise<PiSkill[]> {
  const searchDirs = [
    resolve(cwd, '.pi', 'skills'),
    resolve(cwd, '.agents', 'skills'),
    ...(extraPaths ?? []).map(p => resolve(cwd, p)),
  ];

  const allSkills: PiSkill[] = [];
  const seen = new Set<string>();

  for (const dir of searchDirs) {
    const found = await scanSkillDir(dir);
    for (const skill of found) {
      if (!seen.has(skill.name)) {
        seen.add(skill.name);
        allSkills.push(skill);
      }
    }
  }

  if (allSkills.length > 0) {
    getLog().debug(
      { count: allSkills.length, names: allSkills.map(s => s.name) },
      'skills.discover_completed'
    );
  }

  return allSkills;
}

/**
 * Build an `<available_skills>` XML block for injection into the system prompt.
 * Matches the format used by pi-coding-agent.
 */
export function buildSkillSystemPrompt(skills: PiSkill[]): string {
  if (skills.length === 0) return '';

  const skillEntries = skills
    .map(
      s =>
        `  <skill name="${escapeXml(s.name)}" description="${escapeXml(s.description)}" path="${escapeXml(s.filePath)}" />`
    )
    .join('\n');

  return `<available_skills>\n${skillEntries}\n</available_skills>\n\nYou have access to the skills listed above. To use a skill, read the skill file at the given path to get the full instructions.`;
}

/**
 * Load the full content of a skill file.
 * Returns the raw markdown content, or null if the file cannot be read.
 */
export async function loadSkillContent(skillPath: string): Promise<string | null> {
  try {
    return await readFile(skillPath, 'utf-8');
  } catch {
    getLog().warn({ path: skillPath }, 'skills.load_failed');
    return null;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
