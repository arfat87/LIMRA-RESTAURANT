import { createClient } from '@insforge/sdk';

const baseUrl = 'https://vb9ucr22.us-east.insforge.app';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzQ3MjZ9.CORVtgdxoKKq0AhdUN0RY8s1h3jHMUF3ZOB0CpmnoYk';

const insforge = createClient({ baseUrl, anonKey });

async function run() {
  const dummyEmail = `test_${Date.now()}@limratest.com`;
  const dummyPassword = 'password123';
  const dummyName = 'Test User';
  
  console.log('Sending signUp request with email:', dummyEmail);
  const regRes = await insforge.auth.signUp({
    email: dummyEmail,
    password: dummyPassword,
    name: dummyName
  });
  
  console.log('=== signUp result keys ===', Object.keys(regRes));
  console.log('=== signUp result error ===', regRes.error);
  console.log('=== signUp result data ===', JSON.stringify(regRes.data, null, 2));
}

run();
