/**
 * verify-ch1.js — 验证第一章演出（人名/立绘/镜头）
 * 截图保存到 promo/verify/
 */
const { chromium } = require("playwright");
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'promo', 'verify');
fs.mkdirSync(OUT, { recursive: true });

const SERVER = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launchPersistentContext(
    path.join(ROOT, 'promo', 'verify-profile'),
    {
      headless: true,
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    }
  );
  const page = browser.pages()[0] || await browser.newPage();
  await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, '01_title.png') });
  console.log('01_title.png saved');

  // Click the "踏入此界" button by evaluating DOM
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, .btn, a, [onclick]')];
    for (const b of btns) {
      const t = (b.textContent || '').replace(/\s/g, '');
      if (t.includes('踏入此界') || t.includes('开始游戏') || t.includes('进入游戏')) {
        b.click();
        return t;
      }
    }
    // Try clicking any visible button
    for (const b of btns) {
      if (b.offsetParent !== null && b.textContent.trim().length > 0) {
        b.click();
        return 'fallback:' + b.textContent.trim();
      }
    }
    return null;
  });
  console.log('Clicked button:', clicked);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, '02_after_start.png') });
  console.log('02_after_start.png saved');

  // Check for linggen test
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Page text (first 500):', pageText.substring(0, 200));

  // Click 测灵根
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, .btn, a')];
    for (const b of btns) {
      if ((b.textContent || '').replace(/\s/g, '').includes('测灵根')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, '03_linggen.png') });
  console.log('03_linggen.png saved');

  // Now click 踏入此界 again to enter game
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, .btn, a')];
    for (const b of btns) {
      if ((b.textContent || '').replace(/\s/g, '').includes('踏入此界')) { b.click(); return; }
    }
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, '04_enter_game.png') });
  console.log('04_enter_game.png saved');

  // Now we should be in story mode - check for narrative elements
  const storyInfo = await page.evaluate(() => {
    const speaker = document.getElementById('story-speaker');
    const text = document.getElementById('story-text');
    const dialog = document.getElementById('story-dialog');
    const leftPortrait = document.getElementById('story-portrait-left');
    const rightPortrait = document.getElementById('story-portrait-right');
    const storyTitle = document.getElementById('story-title');
    return {
      speakerText: speaker ? speaker.innerText : 'N/A',
      storyText: text ? text.innerText.substring(0, 200) : 'N/A',
      dialogVisible: dialog ? dialog.style.display !== 'none' : 'N/A',
      leftPortraitImg: leftPortrait ? (leftPortrait.querySelector('img') ? leftPortrait.querySelector('img').src : 'NO IMG') : 'N/A',
      rightPortraitImg: rightPortrait ? (rightPortrait.querySelector('img') ? rightPortrait.querySelector('img').src : 'NO IMG') : 'N/A',
      storyTitle: storyTitle ? storyTitle.innerText : 'N/A',
      bodyText: document.body.innerText.substring(0, 300),
    };
  });
  console.log('Story info:', JSON.stringify(storyInfo, null, 2));
  await page.screenshot({ path: path.join(OUT, '05_story_village.png') });
  console.log('05_story_village.png saved');

  // Click to advance story (tap to continue)
  for (let i = 0; i < 5; i++) {
    // Click on the story dialog area to advance
    try {
      await page.click('#story-dialog', { timeout: 2000 });
    } catch(e) {
      // Try clicking center of screen
      await page.mouse.click(215, 400);
    }
    await page.waitForTimeout(1500);
    
    const info = await page.evaluate(() => {
      const speaker = document.getElementById('story-speaker');
      const text = document.getElementById('story-text');
      const leftP = document.getElementById('story-portrait-left');
      const rightP = document.getElementById('story-portrait-right');
      return {
        speaker: speaker ? speaker.innerText : 'N/A',
        text: text ? text.innerText.substring(0, 150) : 'N/A',
        leftImg: leftP ? (leftP.querySelector('img') ? 'HAS IMG' : 'NO IMG') : 'N/A',
        rightImg: rightP ? (rightP.querySelector('img') ? 'HAS IMG' : 'NO IMG') : 'N/A',
      };
    });
    console.log(`Beat ${i+1}:`, JSON.stringify(info));
    await page.screenshot({ path: path.join(OUT, `06_beat_${i+1}.png`) });
  }
  console.log('06_beat_*.png saved');

  // Check if choices appeared
  const choices = await page.evaluate(() => {
    const c = document.getElementById('story-choices');
    if (!c) return [];
    return [...c.querySelectorAll('button, .choice, [class*="choice"]')].map(b => b.textContent.trim());
  });
  console.log('Choices:', JSON.stringify(choices));
  await page.screenshot({ path: path.join(OUT, '07_choices.png') });
  console.log('07_choices.png saved');

  // Click first choice if available
  if (choices.length > 0) {
    try {
      await page.click('#story-choices button', { timeout: 3000 });
      await page.waitForTimeout(2000);
    } catch(e) {}
  }
  await page.screenshot({ path: path.join(OUT, '08_next_stage.png') });
  console.log('08_next_stage.png saved');

  // Get final state
  const finalInfo = await page.evaluate(() => {
    const speaker = document.getElementById('story-speaker');
    const text = document.getElementById('story-text');
    const title = document.getElementById('story-title');
    return {
      speaker: speaker ? speaker.innerText : 'N/A',
      text: text ? text.innerText.substring(0, 200) : 'N/A',
      title: title ? title.innerText : 'N/A',
    };
  });
  console.log('Final:', JSON.stringify(finalInfo, null, 2));

  await browser.close();
  console.log('\nDone! Screenshots saved to promo/verify/');
})();
