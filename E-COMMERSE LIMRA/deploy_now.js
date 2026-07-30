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

proc.stdout.on('data', (data) => {
  const str = data.toString();
  buffer += str;
  console.log(str);
  
  try {
    const lines = buffer.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line.startsWith('{') && line.endsWith('}')) {
        const json = JSON.parse(line);
        if (json.id === 4) {
          console.log('=== DEPLOYMENT RESULT ===');
          console.log(JSON.stringify(json.result, null, 2));
          proc.kill();
          process.exit(0);
        }
      }
    }
    buffer = lines[lines.length - 1];
  } catch (e) {
    // Wait for more data
  }
});

proc.stderr.on('data', (data) => {
  const errStr = data.toString();
  console.error(errStr);
  if (errStr.includes('Insforge MCP server started')) {
    setTimeout(() => {
      console.log('Sending create-deployment request...');
      const req = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'create-deployment',
          arguments: {
            sourceDirectory: distDir
          }
        },
        id: 4
      }) + '\n';
      proc.stdin.write(req);
    }, 1000);
  }
});

proc.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
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
