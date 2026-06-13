import fs from 'fs';
import path from 'path';

const distPath = 'node_modules/@insforge/sdk/dist';
if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath);
  console.log('Dist files:', files);
  
  const dtsFiles = files.filter(f => f.endsWith('.d.ts') && f.startsWith('client-'));
  if (dtsFiles.length > 0) {
    const filePath = path.join(distPath, dtsFiles[0]);
    console.log('Target dts file:', filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log(`Target dts lines count: ${lines.length}`);
    
    // Search for signUp and print surrounding lines
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('signUp') || lines[i].includes('signInWithPassword')) {
        const start = Math.max(0, i - 5);
        const end = Math.min(lines.length, i + 15);
        console.log(`--- Context line ${i + 1} in ${dtsFiles[0]} ---`);
        console.log(lines.slice(start, end).join('\n'));
        console.log('----------------------------\n');
      }
    }
  }
}
