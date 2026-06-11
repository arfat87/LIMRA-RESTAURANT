import fetch from 'node-fetch';

const BASE_URL = 'https://vb9ucr22.us-east.insforge.app';
const API_KEY  = 'ik_799af068e8f4fb05944d04497229fe7d';

async function main() {
  const query = `
    SELECT 
        r.rolname AS role, 
        has_function_privilege(r.rolname, 'public.is_admin()', 'EXECUTE') AS has_execute
    FROM 
        pg_roles r
    WHERE 
        r.rolname IN ('anon', 'authenticated', 'public')
    ORDER BY 
        r.rolname;
  `;

  const endpoint = '/api/database/advance/rawsql';
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({ query, params: [] }),
    });
    const body = await res.json();
    console.log(JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Failed to check privileges:', err.message);
  }
}

main();
