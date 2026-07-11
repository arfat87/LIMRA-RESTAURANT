import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://vb9ucr22.us-east.insforge.app',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzQ3MjZ9.CORVtgdxoKKq0AhdUN0RY8s1h3jHMUF3ZOB0CpmnoYk'
});

async function run() {
  console.log("Testing signUp with raw phone number...");
  const res = await client.auth.signUp({
    email: '9999999999',
    password: 'password9999999999',
    name: 'Test Number User'
  });
  console.log("SignUp response:", JSON.stringify(res, null, 2));
}

run().catch(console.error);
