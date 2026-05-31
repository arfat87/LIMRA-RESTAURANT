async function run() {
  const response = await fetch('https://vb9ucr22.us-east.insforge.app/api/health');
  const json = await response.json();
  console.log(JSON.stringify(json, null, 2));
}

run().catch(console.error);
