import { createClient } from '@insforge/sdk';

const baseUrl = 'https://vb9ucr22.us-east.insforge.app';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzQ3MjZ9.CORVtgdxoKKq0AhdUN0RY8s1h3jHMUF3ZOB0CpmnoYk';

const insforge = createClient({ baseUrl, anonKey });

async function run() {
  const emailPattern = 'test_%@limratest.com';
  console.log('Querying customer_profiles for test user...');
  const res = await insforge.database
    .from('customer_profiles')
    .select('*')
    .like('email', emailPattern);
    
  console.log('Profiles found:', res.data);
}

run();
