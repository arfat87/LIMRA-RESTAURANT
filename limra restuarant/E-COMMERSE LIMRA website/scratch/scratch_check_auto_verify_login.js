import { spawn } from 'child_process';
import { createClient } from '@insforge/sdk';

const query = `
SELECT id, email, email_verified 
FROM auth.users 
WHERE email = 'phone_1780422347669@limraresturent.in';
`;

async function runSql(query) {
  return new Promise((resolve) => {
    const proc = spawn('npx', [
      '-y',
      '@insforge/mcp@latest',
      '--api_key',
      'ik_799af068e8f4fb05944d04497229fe7d',
      '--api_base_url',
      'https://vb9ucr22.us-east.insforge.app'
    ], { shell: true });

    let buffer = '';
    proc.stdout.on('data', (data) => {
      const str = data.toString();
      buffer += str;
      try {
        const lines = buffer.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line.startsWith('{') && line.endsWith('}')) {
            const json = JSON.parse(line);
            if (json.id === 2) {
              proc.kill();
              resolve(json.result);
              return;
            }
          }
        }
        buffer = lines[lines.length - 1];
      } catch (e) {}
    });

    proc.stderr.on('data', (data) => {
      const errStr = data.toString();
      if (errStr.includes('Insforge MCP server started')) {
        setTimeout(() => {
          const req = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'run-raw-sql',
              arguments: { query }
            },
            id: 2
          }) + '\n';
          proc.stdin.write(req);
        }, 1000);
      }
    });
  });
}

async function run() {
  const result = await runSql(query);
  console.log('User status in DB:', JSON.stringify(result, null, 2));

  // Try logging in now
  const baseUrl = 'https://vb9ucr22.us-east.insforge.app';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzQ3MjZ9.CORVtgdxoKKq0AhdUN0RY8s1h3jHMUF3ZOB0CpmnoYk';
  const insforge = createClient({ baseUrl, anonKey });

  console.log('Trying to log in with verified account...');
  const loginRes = await insforge.auth.signInWithPassword({
    email: 'phone_1780422347669@limraresturent.in',
    password: 'password123'
  });

  console.log('Login result:', JSON.stringify(loginRes, null, 2));
}

run();
