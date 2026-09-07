async function test() {
  try {
    const url = "مجمع B عمارة 304 شقة 101 https://maps.app.goo.gl/xyz";
    await fetch(url);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
