import fs from 'fs';
import path from 'path';

const FILES_TO_SEARCH = [
  'src/admin-login.js',
  'src/admin.js',
  'src/main.js',
  'src/lib/insforge.js',
  'src/lib/email-service.js'
];

function searchFiles() {
  for (const f of FILES_TO_SEARCH) {
    const fullPath = path.resolve(f);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('customer_profiles') || line.toLowerCase().includes('.from(\'customer_profiles') || line.toLowerCase().includes('profiles')) {
        console.log(`${f}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

searchFiles();
