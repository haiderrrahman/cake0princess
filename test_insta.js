const https = require('https');

https.get('https://www.instagram.com/cake0princess/', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    // Look for image urls
    const regex = /"display_url":"([^"]+)"/g;
    const matches = [...data.matchAll(regex)];
    console.log("Found Insta Images:", matches.length);
    if(matches.length > 0) {
      console.log(matches[0][1].replace(/\\u0026/g, '&'));
    }
  });
}).on('error', (e) => {
  console.error(e);
});
