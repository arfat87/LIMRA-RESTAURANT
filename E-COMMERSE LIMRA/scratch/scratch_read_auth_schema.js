import fs from 'fs';
import path from 'path';

const base = 'node_modules/@insforge/shared-schemas/dist';
const files = ['auth.schema.d.ts', 'auth-api.schema.d.ts'];

for (const file of files) {
  const filePath = path.join(base, file);
  if (fs.existsSync(filePath)) {
    console.log(`=== File: ${file} ===`);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('CreateUserRequest') || lines[i].includes('UserSchema') || lines[i].includes('CreateSessionRequest')) {
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 15);
        console.log(`[Line ${i + 1}]:`);
        console.log(lines.slice(start, end).join('\n'));
        console.log('-------------------\n');
      }
    }
  }
}
