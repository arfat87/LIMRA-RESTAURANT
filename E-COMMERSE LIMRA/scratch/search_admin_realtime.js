import fs from 'fs';
import path from 'path';

const file = 'src/admin.js';
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('subscribe') || line.includes('realtime') || line.includes('WebSocket') || line.includes('on(') || line.includes('channel')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
}
