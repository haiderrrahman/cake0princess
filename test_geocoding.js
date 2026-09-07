async function test() {
  const query = "مجمع B عمارة 304 بسماية";
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  
  const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
  });

  const html = await response.text();
  const fs = require('fs');
  fs.writeFileSync('maps_html.html', html);
  
  // Try to find coordinates like @33.xxx,44.xxx
  const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    console.log("Found:", match[1], match[2]);
  }
}
test();
