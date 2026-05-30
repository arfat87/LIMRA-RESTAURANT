import { spawn } from 'child_process';

const proc = spawn('npx', [
  '-y',
  '@insforge/mcp@latest',
  '--api_key',
  'ik_799af068e8f4fb05944d04497229fe7d',
  '--api_base_url',
  'https://vb9ucr22.us-east.insforge.app'
], { shell: true });

let response = '';

proc.stdout.on('data', (data) => {
  response += data.toString();
  console.log('STDOUT:', data.toString());
});

proc.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString());
});

proc.on('close', (code) => {
  console.log(`process exited with code ${code}`);
});

// Wait 2 seconds for server to start, then send tools/list request
setTimeout(() => {
  const req = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 1
  }) + '\n';
  proc.stdin.write(req);
}, 2000);
