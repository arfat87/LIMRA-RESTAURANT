import fs from 'fs';

function searchFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('100') || line.includes('200') || line.includes('100–200') || line.includes('100-200')) {
      const l = line.toLowerCase();
      if (l.includes('fee') || l.includes('charge') || l.includes('booking') || l.includes('table') || l.includes('indoor')) {
        console.log(`${filePath} line ${idx + 1}: ${line.trim()}`);
      }
    }
  });
}

console.log('--- Search Results ---');
searchFile('c:\\MY_ALL_ITEM\\ALL_PROJECT\\biuld with Ai\\E-COMMERSE LIMRA\\index.html');
searchFile('c:\\MY_ALL_ITEM\\ALL_PROJECT\\biuld with Ai\\E-COMMERSE LIMRA\\src\\main.js');
searchFile('c:\\MY_ALL_ITEM\\ALL_PROJECT\\biuld with Ai\\E-COMMERSE LIMRA\\src\\admin.js');
