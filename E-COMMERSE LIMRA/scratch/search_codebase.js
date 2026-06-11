import fs from 'fs';
import path from 'path';

const file = 'src/main.js';
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('startPendingCountdown')) {
      console.log(`Lines ${idx - 5} to ${idx + 45}:`);
      for (let i = Math.max(0, idx - 5); i < Math.min(lines.length, idx + 45); i++) {
        console.log(`${i + 1}: ${lines[i]}`);
      }
    }
  });
}
