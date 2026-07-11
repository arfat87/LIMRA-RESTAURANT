const BASE_URL = 'https://vb9ucr22.us-east.insforge.app';
const API_KEY  = 'ik_799af068e8f4fb05944d04497229fe7d';

async function runSQL(sql) {
  const res = await fetch(`${BASE_URL}/api/migrations/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return JSON.parse(body);
}

async function main() {
  const sql = process.argv.slice(2).join(' ');
  if (!sql) {
    console.error('Usage: node scratch_run_sql.js "<SQL QUERY>"');
    process.exit(1);
  }
  
  try {
    const result = await runSQL(sql);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('SQL Execution failed:', err.message);
  }
}

main().catch(console.error);
