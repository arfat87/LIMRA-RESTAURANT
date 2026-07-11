import fs from 'fs';

const dtsPath = 'node_modules/@insforge/sdk/dist/index.d.ts';
if (fs.existsSync(dtsPath)) {
  const content = fs.readFileSync(dtsPath, 'utf8');
  console.log('=== SDK Typings (First 2000 chars) ===');
  console.log(content.slice(0, 2000));
} else {
  console.log('index.d.ts not found');
}
