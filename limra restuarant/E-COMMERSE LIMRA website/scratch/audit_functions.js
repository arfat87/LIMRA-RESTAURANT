import fetch from 'node-fetch';

const BASE_URL = 'https://vb9ucr22.us-east.insforge.app';
const API_KEY  = 'ik_799af068e8f4fb05944d04497229fe7d';

async function main() {
  const query = `
    SELECT 
        n.nspname AS schema,
        p.proname AS name,
        pg_get_function_identity_arguments(p.oid) AS args,
        p.prosecdef AS is_security_definer,
        p.proconfig AS configuration
    FROM 
        pg_proc p
    JOIN 
        pg_namespace n ON p.pronamespace = n.oid
    WHERE 
        n.nspname = 'public'
        AND p.prosecdef = true
    ORDER BY 
        p.proname;
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
    console.error('Audit failed:', err.message);
  }
}

main();
