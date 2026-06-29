const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  console.log('浏览器已打开，iPhone 14 Pro Max 视口 (430×932)');
  console.log('请手动操作：测灵根 → 踏入此界 → 看开场剧情');
  console.log('浏览器窗口保持打开，关闭窗口即退出');
  console.log('');

  // 等待用户关闭浏览器
  await page.waitForEvent('close', { timeout: 0 }).catch(() => {});
  await browser.close();
})();
