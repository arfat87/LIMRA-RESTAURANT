import { spawn } from 'child_process';

const queryPolicies = `
  SELECT 
      schemaname, 
      tablename, 
      policyname, 
      permissive, 
      roles, 
      cmd, 
      qual, 
      with_check
  FROM pg_policies
  WHERE tablename IN ('customer_profiles', 'notifications', 'phone_verifications', 'orders', 'bookings')
  ORDER BY tablename, policyname;
`;

const queryFunctions = `
  SELECT 
      p.proname AS function_name,
      pg_get_function_arguments(p.oid) AS arguments,
      p.prosecdef AS is_security_definer,
      p.proconfig AS configuration_settings,
      has_function_privilege('anon', p.oid, 'execute') AS is_executable_by_anon,
      has_function_privilege('authenticated', p.oid, 'execute') AS is_executable_by_authenticated,
      has_function_privilege('public', p.oid, 'execute') AS is_executable_by_public
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('is_admin', 'place_order', 'place_booking', 'get_customer_bookings', 'get_customer_orders', 'tr_on_order_insert', 'tr_on_booking_insert')
  ORDER BY function_name;
`;

function runQuery(query, reqId) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', [
      '-y',
      '@insforge/mcp@latest',
      '--api_key',
      'ik_799af068e8f4fb05944d04497229fe7d',
      '--api_base_url',
      'https://vb9ucr22.us-east.insforge.app'
    ], { shell: true });

    let buffer = '';
    let resolved = false;

    proc.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const json = JSON.parse(line);
            if (json.id === reqId) {
              resolved = true;
              proc.kill();
              resolve(json.result);
              break;
            }
          } catch (e) {}
        }
      }
      buffer = lines[lines.length - 1];
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
            id: reqId
          }) + '\n';
          proc.stdin.write(req);
        }, 1000);
      }
    });

    proc.on('close', (code) => {
      if (!resolved) {
        reject(new Error(`Process exited with code ${code} without resolving query ${reqId}`));
      }
    });
  });
}

async function main() {
  console.log('--- FETCHING POLICIES ---');
  try {
    const policiesResult = await runQuery(queryPolicies, 10);
    const text = policiesResult.content[0].text;
    console.log(text);
  } catch (err) {
    console.error('Failed policies query:', err.message);
  }

  console.log('\n--- FETCHING FUNCTIONS ---');
  try {
    const functionsResult = await runQuery(queryFunctions, 20);
    const text = functionsResult.content[0].text;
    console.log(text);
  } catch (err) {
    console.error('Failed functions query:', err.message);
  }
}

main();
