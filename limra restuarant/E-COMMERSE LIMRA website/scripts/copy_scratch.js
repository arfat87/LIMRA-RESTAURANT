import fs from 'fs';
import path from 'path';

const srcDir = 'scratch';
const destDir = 'scratch2';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
for (const file of files) {
  const srcPath = path.join(srcDir, file);
  const destPath = path.join(destDir, file);
  fs.copyFileSync(srcPath, destPath);
  console.log(`Copied: ${file}`);
}
console.log('Successfully copied all files!');
