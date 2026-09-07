async function test() {
  const url = 'https://maps.app.goo.gl/1ZGUE8B1fUtisJjw5';
  const response = await fetch(url, { redirect: 'follow' });
  console.log(response.url);
}
test();
