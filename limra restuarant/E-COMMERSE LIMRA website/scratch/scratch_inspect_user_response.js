import fs from 'fs';
import path from 'path';

const base = 'node_modules/@insforge/shared-schemas/dist';
const file = 'auth-api.schema.d.ts';
const filePath = path.join(base, file);

if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Find createUserResponseSchema
  let found = false;
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('createUserResponseSchema:')) {
      startIdx = i;
      found = true;
      break;
    }
  }
  
  if (found) {
    console.log('=== createUserResponseSchema Definition ===');
    console.log(lines.slice(startIdx, startIdx + 40).join('\n'));
  }
}
