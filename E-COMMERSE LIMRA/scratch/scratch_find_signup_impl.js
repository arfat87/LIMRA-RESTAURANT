import fs from 'fs';
import path from 'path';

// Let's search the dist directory for files containing "async signUp"
const base = 'node_modules/@insforge/sdk/dist';
if (fs.existsSync(base)) {
  const files = fs.readdirSync(base);
  for (const file of files) {
    if (file.endsWith('.js') || file.endsWith('.mjs')) {
      const filePath = path.join(base, file);
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('signUp(') || content.includes('signUp :') || content.includes('signUp:')) {
        console.log(`=== Found signUp in: ${file} ===`);
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('signUp') && (lines[i].includes('async') || lines[i].includes('function'))) {
            console.log(`[Line ${i + 1}]: ${lines[i]}`);
            console.log(lines.slice(i, i + 35).join('\n'));
            console.log('-------------------\n');
          }
        }
      }
    }
  }
}
