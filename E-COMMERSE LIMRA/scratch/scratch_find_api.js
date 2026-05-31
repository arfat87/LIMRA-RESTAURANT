import { readFileSync } from 'fs';

const src = readFileSync('node_modules/@insforge/sdk/dist/index.mjs', 'utf8');

const regex = /\/api\/[a-zA-Z0-9_/:-]+/g;
const matches = [...src.matchAll(regex)];

console.log('=== Found /api/ paths ===');
const uniquePaths = new Set(matches.map(m => m[0]));
for (const p of uniquePaths) {
  console.log(p);
}
