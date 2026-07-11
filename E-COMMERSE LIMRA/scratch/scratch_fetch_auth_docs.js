import { spawn } from 'child_process';

function callTool(name, args, reqId) {
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
              name,
              arguments: args
            },
            id: reqId
          }) + '\n';
          proc.stdin.write(req);
        }, 1000);
      }
    });

    proc.on('close', (code) => {
      if (!resolved) {
        reject(new Error(`Process exited with code ${code} without resolving tool ${name}`));
      }
    });
  });
}

async function main() {
  console.log('--- FETCHING AUTH SDK DOCS ---');
  try {
    const res = await callTool('fetch-docs', { docType: 'auth-sdk' }, 1);
    if (res && res.content && res.content[0]) {
      console.log(res.content[0].text);
    } else {
      console.log(JSON.stringify(res, null, 2));
    }
  } catch (err) {
    console.error('Failed to fetch auth sdk docs:', err.message);
  }
}

main();
