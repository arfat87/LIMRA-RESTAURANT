import { spawn } from 'child_process';

const query = `
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.customer_profiles;

-- Create policies
CREATE POLICY "Users can read own profile"
  ON public.customer_profiles FOR SELECT
  TO anon, authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.customer_profiles FOR UPDATE
  TO anon, authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.customer_profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can manage profiles"
  ON public.customer_profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Triggers for updated_at
DROP TRIGGER IF EXISTS customer_profiles_updated_at ON public.customer_profiles;
CREATE TRIGGER customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Grant permissions
GRANT ALL ON TABLE public.customer_profiles TO anon, authenticated;
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
          console.log('=== MIGRATION COMPLETE ===');
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
  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer.trim());
      console.log('=== FINAL BUFFER ===', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('=== RAW BUFFER ===', buffer);
    }
  }
  process.exit(0);
});
