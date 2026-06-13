import fs from 'fs';

const files = ['src/main.js', 'src/admin.js', 'index.html', 'admin.html'];

for (const file of files) {
  if (fs.existsSync(file)) {
    const contents = fs.readFileSync(file, 'utf8');
    const lines = contents.split('\n');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('indoor') || line.toLowerCase().includes('fee')) {
        console.log(`[${file}:${index + 1}] ${line.trim()}`);
      }
    });
  }
}
