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

// Wait 3 seconds for server to initialize, then send tools/call request
setTimeout(() => {
  const req = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'create-deployment',
      arguments: {
        sourceDirectory: 'c:\\MY_ALL_ITEM\\ALL_PROJECT\\biuld with Ai\\E-COMMERSE LIMRA\\dist'
      }
    },
    id: 2
  }) + '\n';
  proc.stdin.write(req);
}, 3000);
