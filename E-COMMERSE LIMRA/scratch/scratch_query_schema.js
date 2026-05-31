const BASE_URL = 'https://vb9ucr22.us-east.insforge.app';
const API_KEY  = 'ik_799af068e8f4fb05944d04497229fe7d';

async function main() {
  console.log('Fetching OpenAPI schema from PostgREST root...');
  
  const res = await fetch(`${BASE_URL}/api/database/records/`, {
    method: 'GET',
    headers: {
      'x-api-key': API_KEY,
    },
  });
  
  const body = await res.text();
  console.log('Status:', res.status);
  
  try {
    const data = JSON.parse(body);
    console.log('Paths in OpenAPI schema:');
    if (data.paths) {
      console.log(Object.keys(data.paths));
    } else {
      console.log(data);
    }
  } catch (e) {
    console.log('Response is not JSON:', body.slice(0, 1000));
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
