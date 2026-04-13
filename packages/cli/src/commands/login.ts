import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { createInterface } from 'readline';

interface AuthFile {
  accessToken: string;
  refreshToken: string;
  username: string;
  serverUrl: string;
}

async function readLine(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function readPassword(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  // output: undefined with terminal: false suppresses echo so the password is not shown in the terminal.
  // We avoid `output: null` due to TypeScript type constraints, but setting terminal to false
  // prevents readline from writing input characters back to stdout.
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  return new Promise(resolve => {
    rl.question('', answer => {
      rl.close();
      process.stdout.write('\n'); // advance to next line after silent entry
      resolve(answer);
    });
  });
}

export interface LoginOptions {
  serverUrl?: string;
}

export async function loginCommand(opts: LoginOptions): Promise<number> {
  const serverUrl = opts.serverUrl ?? process.env.ARCHON_SERVER_URL ?? 'http://localhost:3090';

  const username = await readLine('Username: ');
  const password = await readPassword('Password: ');

  try {
    const res = await fetch(`${serverUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      console.error('Login failed: Invalid username or password');
      return 1;
    }

    const data = (await res.json()) as {
      user: { username: string };
      accessToken: string;
      refreshToken: string;
    };
    const authFile: AuthFile = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      username: data.user.username,
      serverUrl,
    };

    const archonHome = process.env.ARCHON_HOME ?? join(process.env.HOME ?? '~', '.archon');
    mkdirSync(archonHome, { recursive: true });
    writeFileSync(join(archonHome, 'auth.json'), JSON.stringify(authFile, null, 2), {
      mode: 0o600,
    });

    console.log(`Logged in as ${data.user.username}`);
    console.log(`Credentials saved to ${join(archonHome, 'auth.json')}`);
    return 0;
  } catch (error) {
    console.error(`Login error: ${(error as Error).message}`);
    return 1;
  }
}
