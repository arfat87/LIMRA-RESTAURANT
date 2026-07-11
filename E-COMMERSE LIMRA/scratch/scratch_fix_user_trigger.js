import { spawn } from 'child_process';

const query = `
-- Create automatic trigger on auth.users insert to initialize customer profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.customer_profiles (id, name, phone, email, address)
  VALUES (
    NEW.id,
    COALESCE(NEW.metadata->>'name', NEW.profile->>'name', 'Limra Foodie'),
    COALESCE(NEW.metadata->>'phone', NEW.profile->>'phone', '9876543210'),
    NEW.email,
    '[]'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`;

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
          console.log('=== USER TRIGGER FIX RESULT ===');
          if (json.result && json.result.content && json.result.content[0]) {
            console.log(json.result.content[0].text);
          } else {
            console.log(JSON.stringify(json.result, null, 2));
          }
          proc.kill();
          process.exit(0);
        }
      }
    }
    buffer = lines[lines.length - 1];
  } catch (e) {
  }
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
          arguments: {
            query: query
          }
        },
        id: 2
      }) + '\n';
      proc.stdin.write(req);
    }, 1000);
  }
});

proc.on('close', (code) => {
  process.exit(0);
});
