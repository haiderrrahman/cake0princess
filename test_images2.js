const https = require('https');
const urls = [
  "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80",
  "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=400&q=80",
  "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80",
  "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=400&q=80",
  "https://images.unsplash.com/photo-1587241321921-91a834d6d191?w=400&q=80",
  "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
  "https://images.unsplash.com/photo-1530103043960-ef38714abb15?w=400&q=80",
  "https://images.unsplash.com/photo-1596647466885-c54c33075677?w=400&q=80",
  "https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=400&q=80",
  "https://images.unsplash.com/photo-1611082264871-3fcf645672ab?w=400&q=80"
];

urls.forEach(url => {
  https.get(url, res => {
    console.log(`${res.statusCode} - ${url}`);
  }).on('error', e => {
    console.log(`ERROR: ${url}`);
  });
});
