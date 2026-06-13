import fs from 'fs';
import path from 'path';

const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.insforge',
  '.vite',
  '.vercel',
  'deploy_temp'
]);

function buildTree(dir, prefix = '') {
  let output = '';
  const list = fs.readdirSync(dir);
  
  const items = list.map(name => {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    return { name, isDir: stat.isDirectory() };
  }).sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  const filtered = items.filter(item => !IGNORE_DIRS.has(item.name));

  filtered.forEach((item, index) => {
    const isLast = index === filtered.length - 1;
    const marker = isLast ? '└── ' : '├── ';
    const fullPath = path.join(dir, item.name);
    const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/').toLowerCase();

    // Collapse deep files inside asset directories
    if (
      relPath.includes('public/images/') || 
      relPath.includes('public/media/') || 
      relPath.includes('src/media/')
    ) {
      if (index === 0) {
        output += `${prefix}└── ... [collapsed asset files]\n`;
      }
      return;
    }

    output += `${prefix}${marker}${item.name}${item.isDir ? '/' : ''}\n`;
    
    if (item.isDir) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      output += buildTree(fullPath, newPrefix);
    }
  });

  return output;
}

const rootDir = process.cwd();
console.log('E-COMMERSE LIMRA/');
console.log(buildTree(rootDir));
