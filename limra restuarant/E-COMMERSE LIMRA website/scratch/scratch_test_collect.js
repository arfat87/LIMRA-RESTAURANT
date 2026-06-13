import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SOURCE_DIR = path.resolve('dist');

function getRelativePath(absolutePath) {
  return path.relative(SOURCE_DIR, absolutePath).split(path.sep).join('/').replace(/\\/g, '/');
}

function shouldExclude(normalizedPath) {
  const segments = normalizedPath.split('/');
  if (segments.some(seg => seg === '.env' || seg.startsWith('.env.'))) return true;
  const excludedSegments = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.insforge']);
  if (segments.some(seg => excludedSegments.has(seg))) return true;
  return normalizedPath === '.DS_Store' || normalizedPath.endsWith('/.DS_Store') || normalizedPath.endsWith('.log');
}

async function walk(currentDir) {
  const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relPath = getRelativePath(fullPath);
    const excluded = shouldExclude(relPath);
    console.log(`Path: ${relPath} | Excluded: ${excluded} | IsDir: ${entry.isDirectory()}`);
    
    if (entry.isDirectory()) {
      if (!excluded) {
        await walk(fullPath);
      }
    }
  }
}

walk(SOURCE_DIR).catch(console.error);
