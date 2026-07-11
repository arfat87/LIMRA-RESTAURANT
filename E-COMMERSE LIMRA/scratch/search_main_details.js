import fs from 'fs';

const content = fs.readFileSync('c:\\MY_ALL_ITEM\\ALL_PROJECT\\biuld with Ai\\E-COMMERSE LIMRA\\src\\main.js', 'utf8');
const lines = content.split('\n');

console.log('--- Search: fee, indoor, 50, 100, 200 in main.js ---');
lines.forEach((line, idx) => {
  const l = line.toLowerCase();
  if (l.includes('fee') || l.includes('indoor') || l.includes('rupees') || l.includes('charge')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
