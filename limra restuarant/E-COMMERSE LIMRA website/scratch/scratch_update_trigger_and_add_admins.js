import { spawn } from 'child_process';

const query = `
-- 1. Update trigger function
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

  -- Automatically grant admin rights to specified owner emails
  IF NEW.email IN ('arfatalis451@gmail.com', 'limrarestaurant99@gmail.com') THEN
    INSERT INTO public.admin_users (user_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Revoke privileges
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- 3. Retroactively insert existing auth users matching these emails into admin_users
INSERT INTO public.admin_users (user_id, email)
SELECT id, email FROM auth.users
WHERE email IN ('arfatalis451@gmail.com', 'limrarestaurant99@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

-- 4. Verify the updated admin list
SELECT * FROM public.admin_users;
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
        if (json.id === 10) {
          console.log('=== SQL UPDATE COMPLETED ===');
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
        id: 10
      }) + '\n';
      proc.stdin.write(req);
    }, 1000);
  }
});

proc.on('close', (code) => {
  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer.trim());
      console.log('=== FINAL RESULT ===', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('=== RAW RESULT ===', buffer);
    }
  }
  process.exit(0);
});
