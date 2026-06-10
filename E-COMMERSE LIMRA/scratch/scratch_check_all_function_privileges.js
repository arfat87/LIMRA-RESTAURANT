import { spawn } from 'child_process';

const query = `
SELECT p.proname, rp.grantee, rp.privilege_type 
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN information_schema.routine_privileges rp ON rp.routine_name = p.proname
WHERE n.nspname = 'public'
  AND p.proname IN ('is_admin', 'place_order', 'place_booking', 'get_customer_bookings', 'get_customer_orders', 'tr_on_order_insert', 'tr_on_booking_insert')
ORDER BY p.proname, rp.grantee;
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
        if (json.id === 75) {
          console.log('=== FUNCTION PRIVILEGES ===');
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
        id: 75
      }) + '\n';
      proc.stdin.write(req);
    }, 1000);
  }
});

proc.on('close', (code) => {
  process.exit(0);
});
