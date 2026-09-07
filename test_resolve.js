async function test() {
  const url = 'https://maps.app.goo.gl/1ZGUE8B1fUtisJjw5?g_st=ic';
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    console.log("Final URL:", response.url);
    const match = response.url.match(/([-+]?\d{1,2}\.\d+),\s*([-+]?\d{1,3}\.\d+)/);
    if (match) {
      console.log("Coordinates:", match[1], match[2]);
    } else {
      console.log("No coordinates found.");
    }
  } catch (err) {
    console.error(err);
  }
}
test();
