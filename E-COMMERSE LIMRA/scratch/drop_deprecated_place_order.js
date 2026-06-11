import fetch from 'node-fetch';

const BASE_URL = 'https://vb9ucr22.us-east.insforge.app';
const API_KEY  = 'ik_799af068e8f4fb05944d04497229fe7d';

async function main() {
  const query = `
    DROP FUNCTION IF EXISTS public.place_order(
      text, text, text, jsonb, numeric, numeric, text, text, boolean, text, integer, text
    );
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
    const body = await res.text();
    console.log('Drop status:', res.status, body);
  } catch (err) {
    console.error('Drop failed:', err.message);
  }
}

main();
