import { readFileSync } from 'fs';

const src = readFileSync('node_modules/@insforge/sdk/dist/index.mjs', 'utf8');

// Let's search for "class Database" or "class InsForgeClient"
const dbClassIdx = src.indexOf('class Database');
if (dbClassIdx > -1) {
  console.log('=== Database class definition ===');
  console.log(src.slice(dbClassIdx, dbClassIdx + 2000));
} else {
  // Let's search for "Database =" or function Database
  console.log('Class Database not found, trying other patterns...');
  const idx = src.indexOf('var Database =');
  if (idx > -1) {
    console.log(src.slice(idx, idx + 2000));
  } else {
    // Let's search for database exports or where it is defined
    const dbPropIdx = src.indexOf('this.database =');
    if (dbPropIdx > -1) {
      console.log('=== this.database definition ===');
      console.log(src.slice(dbPropIdx - 200, dbPropIdx + 800));
    }
  }
}
