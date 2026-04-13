import { pool, getDialect } from './connection';
import type { User, ProjectMember } from '../types';
import { createLogger } from '@archon/paths';

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('db.users');
  return cachedLog;
}

export async function createUser(data: {
  username: string;
  password_hash: string;
  display_name?: string;
  role?: 'admin' | 'user';
}): Promise<User> {
  const dialect = getDialect();
  const id = dialect.generateUuid();
  const now = dialect.now();
  const role = data.role ?? 'user';

  const result = await pool.query<User>(
    `INSERT INTO remote_agent_users (id, username, password_hash, display_name, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, ${now}, ${now}) RETURNING *`,
    [id, data.username, data.password_hash, data.display_name ?? null, role]
  );
  if (!result.rows[0]) {
    throw new Error('Failed to create user: INSERT succeeded but no row returned');
  }
  getLog().info({ userId: id, username: data.username, role }, 'user.create_completed');
  return result.rows[0];
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await pool.query<User>('SELECT * FROM remote_agent_users WHERE username = $1', [
    username,
  ]);
  return result.rows[0] ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await pool.query<User>('SELECT * FROM remote_agent_users WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function countUsers(): Promise<number> {
  const result = await pool.query<{ count: string | number }>(
    'SELECT COUNT(*) as count FROM remote_agent_users'
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function createProjectMember(
  userId: string,
  codebaseId: string,
  role: 'owner' | 'member'
): Promise<ProjectMember> {
  const result = await pool.query<ProjectMember>(
    `INSERT INTO remote_agent_project_members (user_id, codebase_id, role)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, codebaseId, role]
  );
  if (!result.rows[0]) {
    throw new Error('Failed to create project member: INSERT succeeded but no row returned');
  }
  getLog().info({ userId, codebaseId, role }, 'project_member.create_completed');
  return result.rows[0];
}

export async function getUserCodebaseIds(userId: string): Promise<string[]> {
  const result = await pool.query<{ codebase_id: string }>(
    'SELECT codebase_id FROM remote_agent_project_members WHERE user_id = $1',
    [userId]
  );
  return result.rows.map(r => r.codebase_id);
}

export async function isMember(userId: string, codebaseId: string): Promise<boolean> {
  const result = await pool.query<{ count: string | number }>(
    'SELECT COUNT(*) as count FROM remote_agent_project_members WHERE user_id = $1 AND codebase_id = $2',
    [userId, codebaseId]
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}
