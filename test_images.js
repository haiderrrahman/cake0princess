const https = require('https');
const urls = [
  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80",
  "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&q=80",
  "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80",
  "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?w=400&q=80",
  "https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=400&q=80",
  "https://images.unsplash.com/photo-1519869325930-281384150729?w=400&q=80",
  "https://images.unsplash.com/photo-1556910103-1c02745a8720?w=400&q=80",
  "https://images.unsplash.com/photo-1486427944781-dbf45f4823a0?w=400&q=80",
  "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=400&q=80",
  "https://images.unsplash.com/photo-1508338712271-40539c9f2b86?w=400&q=80",
  "https://images.unsplash.com/photo-1557925923-33b251d59005?w=400&q=80",
  "https://images.unsplash.com/photo-1511381939415-e440c05fbdf7?w=400&q=80",
  "https://images.unsplash.com/photo-1558280625-f6734ff2bc52?w=400&q=80",
  "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=400&q=80",
  "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=400&q=80",
  "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=400&q=80",
  "https://images.unsplash.com/photo-1514517521153-1be72277b32f?w=400&q=80"
];

urls.forEach(url => {
  https.get(url, res => {
    console.log(`${res.statusCode} - ${url}`);
  }).on('error', e => {
    console.log(`ERROR: ${url}`);
  });
});
