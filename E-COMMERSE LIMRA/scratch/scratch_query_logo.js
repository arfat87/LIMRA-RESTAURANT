async function main() {
  const url = 'https://vb9ucr22.insforge.site/images/logo.png';
  console.log('Fetching logo from:', url);
  const res = await fetch(url);
  console.log('Status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));
}

main().catch(console.error);
