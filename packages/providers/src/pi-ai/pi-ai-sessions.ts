/**
 * File-based session store for Pi-AI provider.
 *
 * Stores sessions as JSONL files under ~/.archon/sessions/{sessionId}.json.
 * Each file contains AgentMessage[] serialized as JSON (one message per line
 * for append-friendly writes).
 *
 * All I/O is wrapped in try/catch — failures log warnings but never crash
 * the caller (graceful degradation to empty history on load failure).
 */
import type { AgentMessage } from '@mariozechner/pi-agent-core';
import { getArchonSessionsPath } from '@archon/paths';
import { createLogger } from '@archon/paths';
import { join } from 'path';
import { mkdir, readFile, writeFile, unlink, readdir, stat, rename } from 'fs/promises';
import { existsSync } from 'fs';

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('pi-ai-sessions');
  return cachedLog;
}

/**
 * File-based session store for persisting Pi-AI agent messages.
 */
export class PiAiSessionStore {
  private readonly sessionsDir: string;

  constructor(sessionsDir?: string) {
    this.sessionsDir = sessionsDir ?? getArchonSessionsPath();
  }

  /**
   * Ensure the sessions directory exists.
   */
  private async ensureDir(): Promise<void> {
    if (!existsSync(this.sessionsDir)) {
      await mkdir(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Get the file path for a session.
   */
  private sessionPath(sessionId: string): string {
    return join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Save messages for a session. Uses atomic write (temp file + rename)
   * to prevent corruption from concurrent writes.
   */
  async save(sessionId: string, messages: AgentMessage[]): Promise<void> {
    try {
      await this.ensureDir();
      const targetPath = this.sessionPath(sessionId);
      const tempPath = `${targetPath}.tmp`;

      // Write each message as a separate JSON line (JSONL format)
      const lines = messages.map(msg => JSON.stringify(msg)).join('\n');
      await writeFile(tempPath, lines, 'utf-8');

      // Atomic rename
      await rename(tempPath, targetPath);

      getLog().debug(
        { sessionId, messageCount: messages.length, path: targetPath },
        'session_saved'
      );
    } catch (err) {
      getLog().warn({ err, sessionId }, 'session_save_failed');
    }
  }

  /**
   * Load messages for a session. Returns null if session doesn't exist
   * or if the file is corrupt.
   */
  async load(sessionId: string): Promise<AgentMessage[] | null> {
    try {
      const targetPath = this.sessionPath(sessionId);

      if (!existsSync(targetPath)) {
        return null;
      }

      const content = await readFile(targetPath, 'utf-8');
      if (!content.trim()) {
        return [];
      }

      const lines = content.split('\n').filter(line => line.trim());
      const messages: AgentMessage[] = [];

      for (const line of lines) {
        try {
          messages.push(JSON.parse(line) as AgentMessage);
        } catch {
          getLog().warn({ sessionId, line: line.slice(0, 100) }, 'session_line_parse_failed');
        }
      }

      return messages;
    } catch (err) {
      getLog().warn({ err, sessionId }, 'session_load_failed');
      return null;
    }
  }

  /**
   * Delete a session file.
   */
  async delete(sessionId: string): Promise<void> {
    try {
      const targetPath = this.sessionPath(sessionId);
      if (existsSync(targetPath)) {
        await unlink(targetPath);
        getLog().debug({ sessionId }, 'session_deleted');
      }
    } catch (err) {
      getLog().warn({ err, sessionId }, 'session_delete_failed');
    }
  }

  /**
   * Clean up session files older than the specified number of days.
   * Returns the number of deleted sessions.
   */
  async cleanup(maxAgeDays: number): Promise<number> {
    try {
      if (!existsSync(this.sessionsDir)) {
        return 0;
      }

      const entries = await readdir(this.sessionsDir);
      const now = Date.now();
      const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
      let deleted = 0;

      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;

        const filePath = join(this.sessionsDir, entry);
        try {
          const fileStat = await stat(filePath);
          const ageMs = now - fileStat.mtimeMs;

          if (ageMs > maxAgeMs) {
            await unlink(filePath);
            deleted++;
            getLog().debug(
              { file: entry, ageDays: Math.round(ageMs / (24 * 60 * 60 * 1000)) },
              'session_cleaned_up'
            );
          }
        } catch (err) {
          getLog().warn({ err, file: entry }, 'session_cleanup_file_failed');
        }
      }

      if (deleted > 0) {
        getLog().info({ deleted, maxAgeDays }, 'session_cleanup_completed');
      }

      return deleted;
    } catch (err) {
      getLog().warn({ err, maxAgeDays }, 'session_cleanup_failed');
      return 0;
    }
  }
}
