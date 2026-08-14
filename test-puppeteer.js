import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('https://cake0princess.vercel.app/courses/Utr5XBdJwcL8LTCv3MO3', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/haiderrahman/.gemini/antigravity-ide/brain/91deb46b-5485-4e51-8d95-7fd0b26bf304/artifacts/puppeteer-screenshot.png' });
  await browser.close();
})();
