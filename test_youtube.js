const https = require('https');

https.get('https://www.youtube.com/@Cake.Princess/videos', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    // Look for video IDs
    const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    const matches = [...data.matchAll(regex)];
    const uniqueIds = [...new Set(matches.map(m => m[1]))].slice(0, 5);
    console.log("Found Video IDs:", uniqueIds);
  });
}).on('error', (e) => {
  console.error(e);
});
