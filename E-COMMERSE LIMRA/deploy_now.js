import { spawn } from 'child_process';
import path from 'path';

const distDir = path.resolve('dist');
console.log(`Starting InsForge deployment for build directory: ${distDir}`);

const proc = spawn('npx', [
  '-y',
  '@insforge/mcp@latest',
  '--api_key',
  'ik_799af068e8f4fb05944d04497229fe7d',
  '--api_base_url',
  'https://vb9ucr22.us-east.insforge.app'
], { shell: true });

let buffer = '';

function sendJson(obj) {
  const str = JSON.stringify(obj) + '\n';
  console.log('>>> SENDING:', str.trim());
  proc.stdin.write(str);
}

proc.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep unfinished fragment

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    console.log('<<< RECV:', trimmed);
    try {
      const msg = JSON.parse(trimmed);

      // Response to initialize (id: 1)
      if (msg.id === 1) {
        console.log('✓ MCP Initialized! Sending initialized notification & listing tools...');
        sendJson({ jsonrpc: '2.0', method: 'notifications/initialized' });
        sendJson({ jsonrpc: '2.0', method: 'tools/list', id: 2 });
      }

      // Response to tools/list (id: 2)
      if (msg.id === 2 && msg.result && msg.result.tools) {
        console.log('✓ Registered tools:', msg.result.tools.map(t => t.name));
        const deployTool = msg.result.tools.find(t => t.name.includes('deploy'));
        const toolName = deployTool ? deployTool.name : 'create-deployment';
        console.log(`Calling deployment tool "${toolName}"...`);
        sendJson({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: {
              sourceDirectory: distDir
            }
          },
          id: 3
        });
      }

      // Response to tools/call (id: 3)
      if (msg.id === 3) {
        console.log('🎉 DEPLOYMENT SUCCESSFUL!');
        console.log(JSON.stringify(msg.result, null, 2));
        proc.kill();
        process.exit(0);
      }
    } catch (e) {
      // not JSON line, ignore
    }
  }
});

proc.stderr.on('data', (data) => {
  const errStr = data.toString();
  console.error('[STDERR]', errStr.trim());
  if (errStr.includes('Insforge MCP server started')) {
    console.log('Sending MCP initialize request...');
    sendJson({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'insforge-deployer', version: '1.0.0' }
      },
      id: 1
    });
  }
});

proc.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
  process.exit(0);
});
