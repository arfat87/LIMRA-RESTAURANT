import fs from 'fs';
import path from 'path';

const base = 'node_modules/@insforge/shared-schemas/dist';
const file = 'auth-api.schema.d.ts';
const filePath = path.join(base, file);

if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Search for createUserResponseSchema
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('createUserResponseSchema') || lines[i].includes('createUserResponseSchema =')) {
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length, i + 30);
      console.log(`[Line ${i + 1}]:`);
      console.log(lines.slice(start, end).join('\n'));
      console.log('-------------------\n');
    }
  }
}
