import fs from 'fs';
import path from 'path';

const content = fs.readFileSync('src/admin.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('insforge.auth') || line.includes('currentUser') || line.includes('admin_users') || line.includes('redirectToLogin')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
