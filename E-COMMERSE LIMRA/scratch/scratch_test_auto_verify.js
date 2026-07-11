import { spawn } from 'child_process';
import { createClient } from '@insforge/sdk';

const sql = `
-- Create function to auto-verify phone users (whose email ends in @limraresturent.in)
CREATE OR REPLACE FUNCTION public.auto_verify_phone_users()
RETURNS trigger AS $$
BEGIN
  IF NEW.email LIKE '%@limraresturent.in' THEN
    NEW.email_verified := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_verifying ON auth.users;
CREATE TRIGGER on_auth_user_verifying
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_verify_phone_users();
`;

// Helper to run SQL
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
  console.log('Deploying auto-verify trigger...');
  const result = await runSql(sql);
  console.log('Result:', JSON.stringify(result, null, 2));

  // Initialize client and test signup
  const baseUrl = 'https://vb9ucr22.us-east.insforge.app';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzQ3MjZ9.CORVtgdxoKKq0AhdUN0RY8s1h3jHMUF3ZOB0CpmnoYk';
  const insforge = createClient({ baseUrl, anonKey });

  const dummyEmail = `phone_${Date.now()}@limraresturent.in`;
  const dummyPassword = 'password123';

  console.log('Signing up phone user with email:', dummyEmail);
  const regRes = await insforge.auth.signUp({
    email: dummyEmail,
    password: dummyPassword,
    name: 'Phone User Test'
  });

  console.log('=== signUp result ===', JSON.stringify(regRes, null, 2));
}

run();
