import { spawn } from 'child_process';

const query = `
-- 1. Redefine the trigger function to use NEW.metadata and NEW.profile instead of NEW.raw_user_meta_data
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

-- 2. Drop the existing insert policy on customer_profiles if it exists
DROP POLICY IF EXISTS "Users can insert own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Allow anon and authenticated insert profile" ON public.customer_profiles;

-- 3. Create a permissive insert policy allowing profile creation on signup
CREATE POLICY "Users can insert own profile"
  ON public.customer_profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
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
          console.log('=== REGISTRATION FIX RESULT ===');
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
