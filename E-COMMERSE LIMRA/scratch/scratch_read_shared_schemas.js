import fs from 'fs';

const p = 'node_modules/@insforge/shared-schemas/dist/index.d.ts';
if (fs.existsSync(p)) {
  console.log(fs.readFileSync(p, 'utf8').slice(0, 2000));
} else {
  console.log('File not found');
}
