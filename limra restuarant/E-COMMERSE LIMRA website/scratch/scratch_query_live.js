async function main() {
  console.log('Fetching live website content from https://vb9ucr22.insforge.site/ ...');
  const res = await fetch('https://vb9ucr22.insforge.site/', {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });
  
  const text = await res.text();
  console.log('Status:', res.status);
  
  const hasNewLogo = text.includes('/images/logo.png');
  const hasNewGrid = text.includes('grid-cols-3');
  
  console.log('Has /images/logo.png:', hasNewLogo);
  console.log('Has 3-column mobile layout (grid-cols-3):', hasNewGrid);
  
  // Find where order-grid is in the text
  const gridIdx = text.indexOf('id="order-grid"');
  if (gridIdx > -1) {
    console.log('Found order-grid:');
    console.log(text.slice(gridIdx - 100, gridIdx + 200));
  } else {
    console.log('order-grid NOT found in HTML!');
  }
}

main().catch(console.error);
