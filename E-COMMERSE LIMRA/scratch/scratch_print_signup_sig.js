import fs from 'fs';
import path from 'path';

const dtsPath = 'node_modules/@insforge/sdk/dist/index.d.ts';
if (fs.existsSync(dtsPath)) {
  const content = fs.readFileSync(dtsPath, 'utf8');
  console.log('=== SDK Typings snippet ===');
  // Find lines containing Auth or sign
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('signUp') || line.includes('signIn') || line.includes('class Auth') || line.includes('interface Auth')) {
      // print 10 lines before and 20 lines after
      const start = Math.max(0, i - 5);
      const end = Math.min(lines.length, i + 15);
      console.log(`--- Context for line ${i + 1}: ${line} ---`);
      console.log(lines.slice(start, end).join('\n'));
      console.log('-------------------------\n');
    }
  }
} else {
  console.log('index.d.ts not found');
}
