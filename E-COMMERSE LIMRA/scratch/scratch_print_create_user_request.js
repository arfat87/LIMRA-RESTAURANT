import fs from 'fs';

const p = 'node_modules/@insforge/shared-schemas/dist/index.d.ts';
if (fs.existsSync(p)) {
  const content = fs.readFileSync(p, 'utf8');
  console.log('=== SEARCHING FOR SCHEMAS ===');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes('createuserrequest') || line.toLowerCase().includes('userschema') || line.toLowerCase().includes('create_user')) {
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 10);
      console.log(`[Line ${i + 1}]: ${line}`);
      console.log(lines.slice(start, end).join('\n'));
      console.log('-------------------\n');
    }
  }
}
