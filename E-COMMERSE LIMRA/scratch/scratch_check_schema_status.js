const BASE_URL = 'https://vb9ucr22.us-east.insforge.app';
const API_KEY  = 'ik_799af068e8f4fb05944d04497229fe7d';

async function runSQL(sql) {
  const res = await fetch(`${BASE_URL}/api/database/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    const res2 = await fetch(`${BASE_URL}/api/migrations/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ sql }),
    });
    const body2 = await res2.text();
    if (!res2.ok) {
      throw new Error(`HTTP ${res.status}/${res2.status}: ${body}`);
    }
    return JSON.parse(body2);
  }
  return JSON.parse(body);
}

async function main() {
  console.log('Querying policies...');
  const policiesSql = `
    SELECT 
        schemaname, 
        tablename, 
        policyname, 
        permissive, 
        roles, 
        cmd, 
        qual, 
        with_check
    FROM pg_policies
    WHERE tablename IN ('customer_profiles', 'notifications', 'phone_verifications', 'orders', 'bookings')
    ORDER BY tablename, policyname;
  `;
  try {
    const policies = await runSQL(policiesSql);
    console.log('POLICIES:');
    console.log(JSON.stringify(policies, null, 2));
  } catch (err) {
    console.error('Error fetching policies:', err.message);
  }

  console.log('\nQuerying functions...');
  const functionsSql = `
    SELECT 
        p.proname AS function_name,
        pg_get_function_arguments(p.oid) AS arguments,
        p.prosecdef AS is_security_definer,
        p.proconfig AS configuration_settings,
        has_function_privilege('anon', p.oid, 'execute') AS is_executable_by_anon,
        has_function_privilege('authenticated', p.oid, 'execute') AS is_executable_by_authenticated,
        has_function_privilege('public', p.oid, 'execute') AS is_executable_by_public
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN ('is_admin', 'place_order', 'place_booking', 'get_customer_bookings', 'get_customer_orders', 'tr_on_order_insert', 'tr_on_booking_insert')
    ORDER BY function_name;
  `;
  try {
    const functions = await runSQL(functionsSql);
    console.log('FUNCTIONS:');
    console.log(JSON.stringify(functions, null, 2));
  } catch (err) {
    console.error('Error fetching functions:', err.message);
  }
}

main().catch(console.error);
