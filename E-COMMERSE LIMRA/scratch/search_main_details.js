import fs from 'fs';

const content = fs.readFileSync('c:\\MY_ALL_ITEM\\ALL_PROJECT\\biuld with Ai\\E-COMMERSE LIMRA\\src\\admin.js', 'utf8');
const lines = content.split('\n');

console.log('--- admin.js lines 380 to 430 ---');
for (let i = 380; i <= Math.min(430, lines.length); i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
