import { spawn } from 'child_process';

const query = `
SELECT id, email, created_at, metadata, profile FROM auth.users WHERE email LIKE 'test_%@limratest.com';
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
          console.log('=== TEST USERS IN AUTH.USERS ===');
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
